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

-- Listings (imported from Navica / other sources)
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  mls_number TEXT,
  address TEXT,
  city TEXT,
  location TEXT,
  price NUMERIC,
  acres NUMERIC,
  sq_ft NUMERIC,
  year_built INTEGER,
  property_type TEXT,
  is_new_construction BOOLEAN DEFAULT false,
  description TEXT,
  raw JSONB,
  imported_at TIMESTAMPTZ DEFAULT now(),
  geometry GEOMETRY(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(property_type);

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

-- RLS helpers (enable later when auth is live)
-- ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
-- etc.
