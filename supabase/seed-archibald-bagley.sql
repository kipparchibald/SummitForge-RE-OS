-- Seed Archibald-Bagley Real Estate as the first production brokerage.
-- Run AFTER schema.sql (and updates). Safe to re-run (upsert by slug).

INSERT INTO brokerages (id, name, slug, branding)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Archibald-Bagley Real Estate',
  'archibald-bagley',
  jsonb_build_object(
    'companyName', 'Archibald-Bagley Real Estate',
    'tagline', 'Your Eastern Idaho Realtors',
    'phone', '(208) 745-5911',
    'domain', 'archibaldbagley.com',
    'primaryColor', '#1e3a5f',
    'secondaryColor', '#2d5a87',
    'accentColor', '#c4a35a',
    'product', 'Voxli.dev'
  )
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  branding = brokerages.branding || EXCLUDED.branding;

-- ---------------------------------------------------------------------------
-- Link your Supabase Auth users to this brokerage
-- 1) Create users in Authentication → Users
-- 2) Copy each user's UUID
-- 3) Uncomment and replace UUIDs below, then run again
-- ---------------------------------------------------------------------------

-- Example admin:
-- INSERT INTO profiles (id, brokerage_id, full_name, phone, role)
-- VALUES (
--   'PASTE-AUTH-USER-UUID-ADMIN',
--   'a0000000-0000-4000-8000-000000000001',
--   'Kipp Archibald',
--   '(208) 745-5911',
--   'admin'
-- )
-- ON CONFLICT (id) DO UPDATE SET
--   brokerage_id = EXCLUDED.brokerage_id,
--   full_name = EXCLUDED.full_name,
--   role = EXCLUDED.role;

-- Example agent:
-- INSERT INTO profiles (id, brokerage_id, full_name, phone, role)
-- VALUES (
--   'PASTE-AUTH-USER-UUID-AGENT',
--   'a0000000-0000-4000-8000-000000000001',
--   'Agent Name',
--   NULL,
--   'agent'
-- )
-- ON CONFLICT (id) DO UPDATE SET
--   brokerage_id = EXCLUDED.brokerage_id,
--   role = EXCLUDED.role;
