-- RISE loop phase 1–3: intent columns on crm_contacts + outreach drafts
-- Run AFTER schema-crm.sql and sprint2 tenant RLS migration.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Intent / queue columns on existing contacts table
-- ---------------------------------------------------------------------------
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS last_touched_at TIMESTAMPTZ;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS intent_reason TEXT;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_score ON crm_contacts (score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_snoozed ON crm_contacts (snoozed_until);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_dismissed ON crm_contacts (dismissed_at);

-- ---------------------------------------------------------------------------
-- Drafted outreach (approve-only; no auto-send)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_outreach_drafts (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  user_id TEXT,
  brokerage_id TEXT NOT NULL DEFAULT 'archibald-bagley',
  channel TEXT NOT NULL DEFAULT 'sms',
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  source TEXT DEFAULT 'today',
  intent_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outreach_contact ON crm_outreach_drafts (contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_brokerage ON crm_outreach_drafts (brokerage_id);
CREATE INDEX IF NOT EXISTS idx_outreach_status ON crm_outreach_drafts (status);
CREATE INDEX IF NOT EXISTS idx_outreach_created ON crm_outreach_drafts (created_at DESC);

ALTER TABLE crm_outreach_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brokerage crm_outreach_drafts" ON crm_outreach_drafts;
CREATE POLICY "brokerage crm_outreach_drafts"
  ON crm_outreach_drafts FOR ALL TO authenticated
  USING (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  )
  WITH CHECK (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  );

-- ---------------------------------------------------------------------------
-- Tighten CRM RLS (replace open policies if still present)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated all crm_contacts" ON crm_contacts;
DROP POLICY IF EXISTS "brokerage crm_contacts" ON crm_contacts;
CREATE POLICY "brokerage crm_contacts"
  ON crm_contacts FOR ALL TO authenticated
  USING (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  )
  WITH CHECK (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  );

DROP POLICY IF EXISTS "authenticated all showing_requests" ON showing_requests;
DROP POLICY IF EXISTS "brokerage showing_requests" ON showing_requests;
CREATE POLICY "brokerage showing_requests"
  ON showing_requests FOR ALL TO authenticated
  USING (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  )
  WITH CHECK (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  );

DROP POLICY IF EXISTS "authenticated all nurture_enrollments" ON nurture_enrollments;
DROP POLICY IF EXISTS "brokerage nurture_enrollments" ON nurture_enrollments;
CREATE POLICY "brokerage nurture_enrollments"
  ON nurture_enrollments FOR ALL TO authenticated
  USING (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  )
  WITH CHECK (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  );
