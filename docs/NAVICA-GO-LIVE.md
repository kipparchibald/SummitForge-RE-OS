# Navica / Snake River MLS feed — go-live runbook

Status as of 2026-07-17: API Agreement signed by Kipp (Vendor). Waiting on
SRMLS countersignature + Service Fee Payment Agreement; credentials arrive
3–5 business days after both. Contact: Tom Massey <tom@navicamls.net> (SEI),
CC Zona Nelson <ceo@snakerivermls.com>. $100/mo, 30-day out.

The feed is ONE API containing both IDX and BBO (Broker Back Office)
datasets; the `FeedTypes` field marks what is publicly displayable. Gating
lives in `lib/import/feedTypes.ts` (fail-closed) — public deployments filter
at ingestion AND at DB reads.

## 0. Before credentials arrive

- [ ] Run `supabase/migrations/2026-07-17-add-visibility.sql` in the Supabase
      SQL editor (project `ngovbzqutiiecgbzbyzx`). Without it every upsert
      fails with 42703 — the hourly cron sync is broken until this runs.
- [ ] If SRMLS countersignature still shows "Waiting" by ~Jul 21, nudge Tom.
- [ ] When the API Data License Agreement (the SRRMLS rights doc) arrives,
      verify Approved Uses cover: DB caching with scheduled refresh,
      analytics/derived reports (land PDF), public IDX display rules,
      BBO-behind-login, and data purge on termination.

## 1. When credentials land

Set in **Vercel → summit-forge-re-os → Settings → Environment Variables**
(production project ONLY — the public demo project deliberately gets neither):

| Var | Value |
| --- | --- |
| `NAVICA_IDX_URL` | Feed URL incl. any `$filter` — coverage follows this filter, not code |
| `NAVICA_API_KEY` | Key/token; `Bearer ...` and `X-API-Key` styles both handled |

Also add both to local `.env.local` for testing. Redeploy after setting.

Setting these automatically:
- switches `fetchArchibaldNavicaListings` from demo data to the live feed;
- disables the `idx-site` scraper (Terms §8(e) bars scraping once the feed
  is live) — verify in logs that `idx-site` no longer runs.

## 2. Validate FeedTypes against real payloads

The parser in `lib/import/feedTypes.ts` guesses common shapes ("IDX",
"BBO", "IDX,VOW", arrays). Before trusting it:

- [ ] Fetch a few live records and inspect the actual `FeedTypes` values.
- [ ] Tighten `PUBLIC_TOKENS` / field names in `feedTypes.ts` to match.
- [ ] Confirm a known BBO-only record comes out `visibility='internal'`
      and never appears on the demo deployment.

## 3. Initial backfill — OVERNIGHT ONLY

The agreement restricts daytime bulk volume. After 10pm MT:

```
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://summit-forge-re-os.vercel.app/api/cron/sync-navica?backfill=1"
```

- Paginates with `$top`/`$skip` (or `@odata.nextLink` if the server sends
  one), upserting page by page — an interrupted run keeps what it fetched.
- Each invocation does up to 40 pages × 200 records within the route's
  300s `maxDuration`. If the response includes `nextSkip`, continue with
  `...?backfill=1&skip=<nextSkip>` until it's absent.
- Success response reports `pages`, `fetched`, `landCount`, `saved`.

## 4. Verify

- [ ] Cron response `saved` > 0 (an anon REST read returning `[]` is RLS
      working, NOT an empty table — check the Supabase Table Editor).
- [ ] Hourly cron (`vercel.json`) green on the next few runs.
- [ ] Demo deployment shows only `visibility='public'` records.
- [ ] Spot-check listings across all 7 counties (Rexburg, Pocatello,
      Driggs, ...) — coverage filter now uses `lib/geo/counties.ts`.
