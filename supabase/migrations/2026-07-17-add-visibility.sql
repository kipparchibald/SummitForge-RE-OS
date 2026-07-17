-- Adds the FeedTypes visibility column to an existing listings table.
-- New databases get this from schema.sql; this migration is for the live DB
-- created before the Navica IDX+BBO gating shipped (lib/import/feedTypes.ts).
--
-- Existing rows all come from sources that are public by construction
-- (CSV upload, idx-site import of our own public website), so the
-- 'public' default is the correct backfill.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

-- Public deployments filter every read on visibility = 'public'.
CREATE INDEX IF NOT EXISTS idx_listings_visibility ON listings (visibility);
