-- Land deal digest storage (used by /api/cron/land-digest).
-- Safe to run standalone; does not modify existing tables.

create table if not exists public.land_deals (
  external_id  text primary key,
  address      text,
  county       text,
  acres        numeric,
  lots         integer,
  list_price   numeric,
  max_offer    numeric,
  spread       numeric,
  verdict      text,
  scanned_at   timestamptz,
  raw          jsonb,
  updated_at   timestamptz default now()
);

create index if not exists land_deals_verdict_idx on public.land_deals (verdict);
create index if not exists land_deals_scanned_idx on public.land_deals (scanned_at desc);
create index if not exists land_deals_spread_idx  on public.land_deals (spread desc);
