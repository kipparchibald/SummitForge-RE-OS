-- SummitForge full schema (run in Supabase SQL editor)
-- Supports multi-tenant alerts, matches, transactions, listings

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tenants / Brokerages
CREATE TABLE IF NOT EXISTS brokerages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  branding JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users (agents)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brokerage_id UUID REFERENCES brokerages(id),
  full_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'agent', -- agent | broker | admin
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Property Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  brokerage_id TEXT NOT NULL,
  name TEXT NOT NULL,
  locations TEXT[] DEFAULT '{}',
  min_price NUMERIC,
  max_price NUMERIC,
  min_acres NUMERIC,
  max_acres NUMERIC,
  property_types TEXT[] DEFAULT '{}',
  new_construction_only BOOLEAN DEFAULT false,
  keywords TEXT[] DEFAULT '{}',
  notify_by TEXT[] DEFAULT '{sms}',
  frequency TEXT DEFAULT 'instant',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_matched_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_brokerage ON alerts(brokerage_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(active) WHERE active = true;

-- Alert Matches
CREATE TABLE IF NOT EXISTS alert_matches (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL,
  match_score NUMERIC NOT NULL,
  matched_at TIMESTAMPTZ DEFAULT now(),
  notified BOOLEAN DEFAULT false,
  notification_method TEXT
);

CREATE INDEX IF NOT EXISTS idx_matches_alert ON alert_matches(alert_id);
CREATE INDEX IF NOT EXISTS idx_matches_time ON alert_matches(matched_at DESC);

-- ============================================
-- Listings table: persistent normalized live data from Navica/MLS/imports
-- Matches NormalizedListing + last_synced + geometry support
-- (Shape matches lib/supabase/client.ts saveListings/queryListings)
-- ============================================
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  address TEXT NOT NULL,
  price NUMERIC NOT NULL,
  acres NUMERIC,
  property_type TEXT,
  description TEXT,
  url TEXT,
  source TEXT,
  -- 'public' (IDX-displayable) or 'internal' (BBO / back-office only).
  -- See lib/import/feedTypes.ts; public surfaces filter on this.
  visibility TEXT NOT NULL DEFAULT 'public',
  last_synced TIMESTAMPTZ DEFAULT NOW(),
  geometry JSONB,           -- Store GeoJSON object {type: 'Point', coordinates: [...] } or full geometry. Use GEOMETRY column for PostGIS spatial if preferred.
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups, searches, and syncs
CREATE INDEX IF NOT EXISTS idx_listings_external_id ON listings (external_id);
CREATE INDEX IF NOT EXISTS idx_listings_source ON listings (source);
CREATE INDEX IF NOT EXISTS idx_listings_last_synced ON listings (last_synced DESC);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings (price);
CREATE INDEX IF NOT EXISTS idx_listings_acres ON listings (acres);
CREATE INDEX IF NOT EXISTS idx_listings_updated_at ON listings (updated_at DESC);

-- Full-text search indexes on address + description for queryListings
CREATE INDEX IF NOT EXISTS idx_listings_address_fts ON listings USING GIN (to_tsvector('english', address));
CREATE INDEX IF NOT EXISTS idx_listings_desc_fts ON listings USING GIN (to_tsvector('english', coalesce(description, '')));

-- Optional: PostGIS geometry column + index (uncomment/adapt if you prefer native GEOMETRY over JSONB)
-- ALTER TABLE listings ADD COLUMN IF NOT EXISTS geom GEOMETRY(Geometry, 4326);
-- CREATE INDEX IF NOT EXISTS idx_listings_geom_gist ON listings USING GIST (geom);
-- To populate geom from geometry jsonb: use trigger or ST_GeomFromGeoJSON(geometry->>'...') on insert.

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  property_id TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  buyer TEXT,
  seller TEXT,
  price NUMERIC,
  timeline JSONB DEFAULT '{}',
  documents JSONB DEFAULT '[]',
  notes TEXT[] DEFAULT '{}',
  brokerage_id TEXT,
  agent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Row Level Security
-- Baseline posture: any signed-in user at the brokerage can read/write
-- operational data (agent-first, single-tenant stage 1). Anonymous users get
-- nothing. Per-tenant isolation (brokerage_id = jwt claim) comes with stage 2.
-- Server-side code using SUPABASE_SERVICE_ROLE_KEY bypasses RLS by design
-- (cron sync, imports).
-- ============================================

ALTER TABLE brokerages ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: users see all profiles (roster), but may only edit their own.
CREATE POLICY "authenticated read profiles" ON profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Brokerages: readable by any signed-in user; managed server-side only.
CREATE POLICY "authenticated read brokerages" ON brokerages
  FOR SELECT TO authenticated USING (true);

-- Operational tables: full access for signed-in brokerage users.
CREATE POLICY "authenticated all alerts" ON alerts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated all alert_matches" ON alert_matches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated all transactions" ON transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Listings: readable by signed-in users; writes come from the server-side
-- import pipeline (service role), not the browser.
CREATE POLICY "authenticated read listings" ON listings
  FOR SELECT TO authenticated USING (true);
