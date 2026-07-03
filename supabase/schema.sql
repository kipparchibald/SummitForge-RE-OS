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