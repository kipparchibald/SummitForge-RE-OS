-- Sprint 2: Durable CRM + showings + nurture enrollments
-- Run in Supabase SQL Editor after core schema.sql
-- Safe to re-run (IF NOT EXISTS / drop policies carefully)

-- ---------------------------------------------------------------------------
-- Contacts (agent pipeline)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  brokerage_id TEXT NOT NULL DEFAULT 'archibald-bagley',
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  stage TEXT NOT NULL DEFAULT 'lead',
  interest TEXT NOT NULL DEFAULT '',
  budget NUMERIC,
  areas TEXT[] NOT NULL DEFAULT '{}',
  source TEXT,
  notes TEXT[] NOT NULL DEFAULT '{}',
  score NUMERIC,
  last_touched_at TIMESTAMPTZ,
  intent_reason TEXT,
  snoozed_until TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_user ON crm_contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_brokerage ON crm_contacts (brokerage_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_stage ON crm_contacts (stage);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_updated ON crm_contacts (updated_at DESC);

-- ---------------------------------------------------------------------------
-- Showing requests (portal → agent inbox)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS showing_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  brokerage_id TEXT NOT NULL DEFAULT 'archibald-bagley',
  match_id TEXT NOT NULL,
  address TEXT NOT NULL,
  preferred_times TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_showings_status ON showing_requests (status);
CREATE INDEX IF NOT EXISTS idx_showings_requested ON showing_requests (requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_showings_brokerage ON showing_requests (brokerage_id);

-- ---------------------------------------------------------------------------
-- Nurture enrollments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nurture_enrollments (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  brokerage_id TEXT NOT NULL DEFAULT 'archibald-bagley',
  contact_id TEXT NOT NULL,
  sequence_id TEXT NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_step_index INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  last_sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nurture_contact ON nurture_enrollments (contact_id);
CREATE INDEX IF NOT EXISTS idx_nurture_status ON nurture_enrollments (status);

-- ---------------------------------------------------------------------------
-- Drafted outreach (approve-only; phase 3 inbox)
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

-- ---------------------------------------------------------------------------
-- RLS — brokerage-scoped (see FIX_RLS_PASTE_THIS.sql + user_brokerage_slug())
-- ---------------------------------------------------------------------------
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE showing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE nurture_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_outreach_drafts ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "brokerage crm_outreach_drafts" ON crm_outreach_drafts;
CREATE POLICY "brokerage crm_outreach_drafts" ON crm_outreach_drafts
  FOR ALL TO authenticated
  USING (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  )
  WITH CHECK (
    brokerage_id = public.user_brokerage_slug()
    OR public.user_is_admin()
  );
