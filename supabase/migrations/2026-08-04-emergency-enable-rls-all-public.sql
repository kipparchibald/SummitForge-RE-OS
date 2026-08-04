-- EMERGENCY: Fix Supabase Security Advisor "rls_disabled_in_public"
-- Project: summitforge (ngovbzqutiiecgbzbyzx)
--
-- Critical: tables in public schema without Row Level Security are readable
-- and writable by anyone who has the project URL + anon key.
--
-- This script:
--   1) Enables RLS on EVERY public base table that lacks it
--   2) Revokes direct privileges from the `anon` role (PostgREST public)
--   3) Ensures `authenticated` / `service_role` still have grants (RLS still applies)
--   4) Re-applies known app policies so signed-in agents keep working
--
-- Safe to re-run. Service role and server connections that use the DB password
-- still work (bypass RLS). Anonymous clients get nothing unless a policy allows it.
--
-- Apply: Supabase Dashboard → SQL Editor → paste → Run
-- Or: psql "$DATABASE_URL" -f this file

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on all public base tables missing it
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'           -- ordinary tables only
      AND NOT c.relrowsecurity      -- RLS currently off
      AND c.relname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
    RAISE NOTICE 'Enabled RLS on public.%', r.table_name;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Lock down grants: anon must not have table rights
--    (RLS alone is enough if no policies, but revoke is defense-in-depth)
-- ---------------------------------------------------------------------------
DO $$
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
    -- Authenticated uses policies; service_role bypasses RLS
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
      r.table_name
    );
    EXECUTE format(
      'GRANT ALL ON TABLE public.%I TO service_role',
      r.table_name
    );
  END LOOP;
END $$;

-- Sequences (if any) — same posture
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS seq_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon', r.seq_name);
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC', r.seq_name);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated', r.seq_name);
    EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role', r.seq_name);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Ensure core tables still have intentional policies (idempotent)
--    Tables with RLS + zero policies are locked to non–service-role clients.
-- ---------------------------------------------------------------------------

-- Helper functions (tenant scope) — create if missing
CREATE OR REPLACE FUNCTION public.user_brokerage_slug()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(b.slug, p.brokerage_id::text)
  FROM profiles p
  LEFT JOIN brokerages b ON b.id = p.brokerage_id
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'broker')
  );
$$;

REVOKE ALL ON FUNCTION public.user_brokerage_slug() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_brokerage_slug() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_admin() TO authenticated;

-- profiles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "authenticated read profiles" ON public.profiles;
    DROP POLICY IF EXISTS "own profile update" ON public.profiles;
    CREATE POLICY "authenticated read profiles" ON public.profiles
      FOR SELECT TO authenticated USING (true);
    CREATE POLICY "own profile update" ON public.profiles
      FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- brokerages
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='brokerages') THEN
    ALTER TABLE public.brokerages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "authenticated read brokerages" ON public.brokerages;
    CREATE POLICY "authenticated read brokerages" ON public.brokerages
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- listings (read for signed-in; writes via service role)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='listings') THEN
    ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "authenticated read listings" ON public.listings;
    DROP POLICY IF EXISTS "public read public listings" ON public.listings;
    CREATE POLICY "authenticated read listings" ON public.listings
      FOR SELECT TO authenticated USING (true);
    -- Optional public IDX surface: only rows marked public/visibility
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='listings' AND column_name='visibility'
    ) THEN
      CREATE POLICY "public read public listings" ON public.listings
        FOR SELECT TO anon
        USING (visibility = 'public');
      GRANT SELECT ON public.listings TO anon;
    END IF;
  END IF;
END $$;

-- Generic brokerage-scoped tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'alerts',
    'alert_matches',
    'crm_contacts',
    'showing_requests',
    'nurture_enrollments',
    'crm_activities',
    'transactions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      -- Drop both open and tenant policies so we re-create cleanly
      EXECUTE format('DROP POLICY IF EXISTS %L ON public.%I', 'authenticated all ' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %L ON public.%I', 'brokerage ' || t, t);
      IF t = 'alert_matches' THEN
        EXECUTE $p$
          CREATE POLICY "brokerage alert_matches" ON public.alert_matches
            FOR ALL TO authenticated
            USING (
              EXISTS (
                SELECT 1 FROM public.alerts a
                WHERE a.id = alert_matches.alert_id
                  AND (
                    a.brokerage_id = public.user_brokerage_slug()
                    OR public.user_is_admin()
                  )
              )
              OR NOT EXISTS (SELECT 1 FROM public.alerts a WHERE a.id = alert_matches.alert_id)
            )
            WITH CHECK (
              EXISTS (
                SELECT 1 FROM public.alerts a
                WHERE a.id = alert_matches.alert_id
                  AND (
                    a.brokerage_id = public.user_brokerage_slug()
                    OR public.user_is_admin()
                  )
              )
              OR NOT EXISTS (SELECT 1 FROM public.alerts a WHERE a.id = alert_matches.alert_id)
            )
        $p$;
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=t AND column_name='brokerage_id'
      ) THEN
        EXECUTE format($p$
          CREATE POLICY "brokerage %1$s" ON public.%1$I
            FOR ALL TO authenticated
            USING (
              brokerage_id = public.user_brokerage_slug()
              OR public.user_is_admin()
              OR brokerage_id IS NULL
            )
            WITH CHECK (
              brokerage_id = public.user_brokerage_slug()
              OR public.user_is_admin()
              OR brokerage_id IS NULL
            )
        $p$, t);
      ELSE
        -- No brokerage column: signed-in only, no anon
        EXECUTE format($p$
          CREATE POLICY "authenticated all %1$s" ON public.%1$I
            FOR ALL TO authenticated USING (true) WITH CHECK (true)
        $p$, t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Verification notices
-- ---------------------------------------------------------------------------
DO $$
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
    RAISE WARNING 'Still % public table(s) without RLS — inspect manually', open_count;
  ELSE
    RAISE NOTICE 'OK: all public base tables have RLS enabled';
  END IF;
END $$;

COMMIT;
