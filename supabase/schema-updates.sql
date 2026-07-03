-- Add to existing schema for monitoring
CREATE TABLE IF NOT EXISTS watched_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  geometry GEOMETRY(Polygon, 4326), -- PostGIS polygon for watched area
  filters JSONB, -- {minAcres, maxPricePerAcre, zoning: []}
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watched_areas_geometry ON watched_areas USING GIST (geometry);

-- Example: Add geometry column to properties if not exists
-- ALTER TABLE properties ADD COLUMN IF NOT EXISTS geometry GEOMETRY(Point, 4326);