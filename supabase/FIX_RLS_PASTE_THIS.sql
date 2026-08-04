-- EMERGENCY: Fix Supabase Security Advisor "rls_disabled_in_public"
-- Project: summitforge (ngovbzqutiiecgbzbyzx)
--
-- Critical: tables in public without Row Level Security are open to anyone
-- with the project URL + anon key.
--
-- Safe to re-run. Paste into Supabase SQL Editor and click Run.
-- If one statement errors, the rest still applied above it may have succeeded.

-- =============================================================================
-- 1) Enable RLS on every public base table that is missing it
-- =============================================================================
DO $enable_rls$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
      AND c.relname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      r.table_name
    );
    RAISE NOTICE 'Enabled RLS on public.%', r.table_name;
  END LOOP;
END
$enable_rls$;

-- =============================================================================
-- 2) Revoke anon / PUBLIC table rights (service_role + authenticated keep access)
-- =============================================================================
DO $lock_grants$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', r.table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', r.table_name);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
      r.table_name
    );
    EXECUTE format(
      'GRANT ALL ON TABLE public.%I TO service_role',
      r.table_name
    );
  END LOOP;

  FOR r IN
    SELECT c.relname AS seq_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon', r.seq_name);
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC', r.seq_name);
    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated',
      r.seq_name
    );
    EXECUTE format(
      'GRANT ALL ON SEQUENCE public.%I TO service_role',
      r.seq_name
    );
  END LOOP;
END
$lock_grants$;

-- =============================================================================
-- 3) Tenant helper functions (no-op if profiles/brokerages missing at call time)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.user_brokerage_slug()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(b.slug, p.brokerage_id::text)
  FROM profiles p
  LEFT JOIN brokerages b ON b.id = p.brokerage_id
  WHERE p.id = auth.uid()
  LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION public.user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'broker')
  );
$fn$;

REVOKE ALL ON FUNCTION public.user_brokerage_slug() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_brokerage_slug() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_admin() TO authenticated;

-- =============================================================================
-- 4) Policies (only if the table exists) — drop + recreate, safe to re-run
-- =============================================================================

-- profiles
DO $pol$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "authenticated read profiles" ON public.profiles;
  DROP POLICY IF EXISTS "own profile update" ON public.profiles;
  CREATE POLICY "authenticated read profiles"
    ON public.profiles FOR SELECT TO authenticated
    USING (true);
  CREATE POLICY "own profile update"
    ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
END
$pol$;

-- brokerages
DO $pol$
BEGIN
  IF to_regclass('public.brokerages') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.brokerages ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "authenticated read brokerages" ON public.brokerages;
  CREATE POLICY "authenticated read brokerages"
    ON public.brokerages FOR SELECT TO authenticated
    USING (true);
END
$pol$;

-- listings
DO $pol$
BEGIN
  IF to_regclass('public.listings') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "authenticated read listings" ON public.listings;
  DROP POLICY IF EXISTS "public read public listings" ON public.listings;
  CREATE POLICY "authenticated read listings"
    ON public.listings FOR SELECT TO authenticated
    USING (true);
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'visibility'
  ) THEN
    CREATE POLICY "public read public listings"
      ON public.listings FOR SELECT TO anon
      USING (visibility = 'public');
    GRANT SELECT ON public.listings TO anon;
  END IF;
END
$pol$;

-- alerts
DO $pol$
BEGIN
  IF to_regclass('public.alerts') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "authenticated all alerts" ON public.alerts;
  DROP POLICY IF EXISTS "brokerage alerts" ON public.alerts;
  CREATE POLICY "brokerage alerts"
    ON public.alerts FOR ALL TO authenticated
    USING (
      brokerage_id = public.user_brokerage_slug()
      OR public.user_is_admin()
    )
    WITH CHECK (
      brokerage_id = public.user_brokerage_slug()
      OR public.user_is_admin()
    );
END
$pol$;

-- alert_matches
DO $pol$
BEGIN
  IF to_regclass('public.alert_matches') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.alert_matches ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "authenticated all alert_matches" ON public.alert_matches;
  DROP POLICY IF EXISTS "brokerage alert_matches" ON public.alert_matches;
  CREATE POLICY "brokerage alert_matches"
    ON public.alert_matches FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.alerts a
        WHERE a.id = alert_matches.alert_id
          AND (
            a.brokerage_id = public.user_brokerage_slug()
            OR public.user_is_admin()
          )
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.alerts a WHERE a.id = alert_matches.alert_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.alerts a
        WHERE a.id = alert_matches.alert_id
          AND (
            a.brokerage_id = public.user_brokerage_slug()
            OR public.user_is_admin()
          )
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.alerts a WHERE a.id = alert_matches.alert_id
      )
    );
END
$pol$;

-- crm_contacts
DO $pol$
BEGIN
  IF to_regclass('public.crm_contacts') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "authenticated all crm_contacts" ON public.crm_contacts;
  DROP POLICY IF EXISTS "brokerage crm_contacts" ON public.crm_contacts;
  CREATE POLICY "brokerage crm_contacts"
    ON public.crm_contacts FOR ALL TO authenticated
    USING (
      brokerage_id = public.user_brokerage_slug()
      OR public.user_is_admin()
    )
    WITH CHECK (
      brokerage_id = public.user_brokerage_slug()
      OR public.user_is_admin()
    );
END
$pol$;

-- showing_requests
DO $pol$
BEGIN
  IF to_regclass('public.showing_requests') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.showing_requests ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "authenticated all showing_requests" ON public.showing_requests;
  DROP POLICY IF EXISTS "brokerage showing_requests" ON public.showing_requests;
  CREATE POLICY "brokerage showing_requests"
    ON public.showing_requests FOR ALL TO authenticated
    USING (
      brokerage_id = public.user_brokerage_slug()
      OR public.user_is_admin()
    )
    WITH CHECK (
      brokerage_id = public.user_brokerage_slug()
      OR public.user_is_admin()
    );
END
$pol$;

-- nurture_enrollments
DO $pol$
BEGIN
  IF to_regclass('public.nurture_enrollments') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.nurture_enrollments ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "authenticated all nurture_enrollments" ON public.nurture_enrollments;
  DROP POLICY IF EXISTS "brokerage nurture_enrollments" ON public.nurture_enrollments;
  CREATE POLICY "brokerage nurture_enrollments"
    ON public.nurture_enrollments FOR ALL TO authenticated
    USING (
      brokerage_id = public.user_brokerage_slug()
      OR public.user_is_admin()
    )
    WITH CHECK (
      brokerage_id = public.user_brokerage_slug()
      OR public.user_is_admin()
    );
END
$pol$;

-- crm_activities
DO $pol$
BEGIN
  IF to_regclass('public.crm_activities') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "brokerage crm_activities" ON public.crm_activities;
  CREATE POLICY "brokerage crm_activities"
    ON public.crm_activities FOR ALL TO authenticated
    USING (
      brokerage_id = public.user_brokerage_slug()
      OR public.user_is_admin()
    )
    WITH CHECK (
      brokerage_id = public.user_brokerage_slug()
      OR public.user_is_admin()
    );
END
$pol$;

-- transactions
DO $pol$
BEGIN
  IF to_regclass('public.transactions') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "authenticated all transactions" ON public.transactions;
  DROP POLICY IF EXISTS "brokerage transactions" ON public.transactions;
  CREATE POLICY "brokerage transactions"
    ON public.transactions FOR ALL TO authenticated
    USING (
      brokerage_id IS NULL
      OR brokerage_id = public.user_brokerage_slug()
      OR public.user_is_admin()
    )
    WITH CHECK (
      brokerage_id IS NULL
      OR brokerage_id = public.user_brokerage_slug()
      OR public.user_is_admin()
    );
END
$pol$;

-- =============================================================================
-- 5) Verify
-- =============================================================================
DO $verify$
DECLARE
  open_count int;
BEGIN
  SELECT count(*) INTO open_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND NOT c.relrowsecurity;

  IF open_count > 0 THEN
    RAISE WARNING
      'Still % public table(s) without RLS — check Table Editor',
      open_count;
  ELSE
    RAISE NOTICE 'OK: all public base tables have RLS enabled';
  END IF;
END
$verify$;
