-- Core Schema for SummitForge
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT,
  parcel_id TEXT,
  geometry GEOMETRY,
  -- etc.
);

-- Add more tables for listings, analyses, etc.

-- ============================================
-- Listings table: persistent normalized live data from Navica/MLS/imports
-- Matches NormalizedListing + last_synced + geometry support
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