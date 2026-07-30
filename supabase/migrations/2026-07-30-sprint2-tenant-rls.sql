-- Sprint 2: tenant-scoped RLS + alert contact columns + CRM activities
-- Run AFTER schema.sql + schema-crm.sql
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Alerts: phone / email / match metadata used by dual-store
-- ---------------------------------------------------------------------------
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE alert_matches ADD COLUMN IF NOT EXISTS alert_name TEXT;
ALTER TABLE alert_matches ADD COLUMN IF NOT EXISTS listing_snapshot JSONB;

-- ---------------------------------------------------------------------------
-- CRM activities (pipeline timeline)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_activities (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  user_id TEXT,
  brokerage_id TEXT NOT NULL DEFAULT 'archibald-bagley',
  kind TEXT NOT NULL DEFAULT 'note', -- note | call | stage_change | enroll | system
  body TEXT NOT NULL DEFAULT '',
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON crm_activities (contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_brokerage ON crm_activities (brokerage_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created ON crm_activities (created_at DESC);

ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper: signed-in user's brokerage slug (TEXT keys on CRM/alerts)
-- profiles.brokerage_id is UUID → brokerages.slug
-- ---------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.user_brokerage_slug() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_brokerage_slug() TO authenticated;

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

REVOKE ALL ON FUNCTION public.user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- Replace open "authenticated all" policies with brokerage isolation.
-- Desk-wide: any agent at the same brokerage can read/write team pipeline.
-- ---------------------------------------------------------------------------

-- alerts
DROP POLICY IF EXISTS "authenticated all alerts" ON alerts;
DROP POLICY IF EXISTS "brokerage alerts" ON alerts;
CREATE POLICY "brokerage alerts" ON alerts
  FOR ALL TO authenticated
  USING (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  )
  WITH CHECK (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  );

-- alert_matches (join via alert or open match rows without FK isolation — use brokerage via join when possible)
DROP POLICY IF EXISTS "authenticated all alert_matches" ON alert_matches;
DROP POLICY IF EXISTS "brokerage alert_matches" ON alert_matches;
CREATE POLICY "brokerage alert_matches" ON alert_matches
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM alerts a
      WHERE a.id = alert_matches.alert_id
        AND (
          a.brokerage_id = public.user_brokerage_slug()
          OR public.user_is_admin()
        )
    )
    -- allow insert of matches for alerts the agent can see
    OR NOT EXISTS (SELECT 1 FROM alerts a WHERE a.id = alert_matches.alert_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM alerts a
      WHERE a.id = alert_matches.alert_id
        AND (
          a.brokerage_id = public.user_brokerage_slug()
          OR public.user_is_admin()
        )
    )
    OR NOT EXISTS (SELECT 1 FROM alerts a WHERE a.id = alert_matches.alert_id)
  );

-- crm_contacts
DROP POLICY IF EXISTS "authenticated all crm_contacts" ON crm_contacts;
DROP POLICY IF EXISTS "brokerage crm_contacts" ON crm_contacts;
CREATE POLICY "brokerage crm_contacts" ON crm_contacts
  FOR ALL TO authenticated
  USING (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  )
  WITH CHECK (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  );

-- showing_requests
DROP POLICY IF EXISTS "authenticated all showing_requests" ON showing_requests;
DROP POLICY IF EXISTS "brokerage showing_requests" ON showing_requests;
CREATE POLICY "brokerage showing_requests" ON showing_requests
  FOR ALL TO authenticated
  USING (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  )
  WITH CHECK (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  );

-- nurture_enrollments
DROP POLICY IF EXISTS "authenticated all nurture_enrollments" ON nurture_enrollments;
DROP POLICY IF EXISTS "brokerage nurture_enrollments" ON nurture_enrollments;
CREATE POLICY "brokerage nurture_enrollments" ON nurture_enrollments
  FOR ALL TO authenticated
  USING (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  )
  WITH CHECK (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  );

-- crm_activities
DROP POLICY IF EXISTS "brokerage crm_activities" ON crm_activities;
CREATE POLICY "brokerage crm_activities" ON crm_activities
  FOR ALL TO authenticated
  USING (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  )
  WITH CHECK (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  );

-- transactions (if table present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "authenticated all transactions" ON transactions';
    EXECUTE 'DROP POLICY IF EXISTS "brokerage transactions" ON transactions';
    EXECUTE $p$
      CREATE POLICY "brokerage transactions" ON transactions
        FOR ALL TO authenticated
        USING (
          brokerage_id IS NULL
          OR brokerage_id = public.user_brokerage_slug()
          OR public.user_is_admin()
        )
        WITH CHECK (
          brokerage_id IS NULL
          OR brokerage_id = public.user_brokerage_slug()
          OR public.user_is_admin()
        )
    $p$;
  END IF;
END $$;

-- Listings remain readable by any authenticated user (IDX board);
-- writes stay service-role only.
