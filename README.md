# SummitForge RE OS

... (previous content)

## Refined Features (July 2026 Update)
- **Refined Parser**: Robust CSV/JSON/URL normalization for MLS, Zillow, LandWatch, Lands of America. Strong land filtering. Auto-triggers raw land projections.
- **GIS-Based Monitoring**: Watched Areas using existing GIS data (PostGIS spatial queries on county parcels, zoning layers). No new drone data required. Detects new/changed land opportunities in defined geometries and triggers projections.

Add `papaparse` for better CSV support.

See lib/import/listings.ts, lib/monitoring/gis-monitor.ts, and supabase/schema-updates.sql