# Sprint 0 — Production foundations runbook

**Goal:** Archibald-Bagley production URL that is *not* a demo: real auth, real DB schema, health green, no demo banner.

**Owner:** Kipp Archibald  
**Repo:** [kipparchibald/SummitForge-RE-OS](https://github.com/kipparchibald/SummitForge-RE-OS)  
**Product brand:** Voxli.dev RE OS  

**Exit criteria:** You can log in, `/api/health` reports `mode: production` + `supabase.schemaOk: true`, demo banner is gone, and one agent account works.

## Production identity

| | |
|---|---|
| Vercel | `voxli/summit-forge-re-os` |
| URL | https://summit-forge-re-os-voxli.vercel.app |
| Brand | Voxli.dev |
| Status | **Production ready** (owner-confirmed) |

See `docs/DEPLOYMENT.md`. Do not re-run this runbook unless health regresses.

---

## 0. Prerequisites (you)

| Item | Where |
|------|--------|
| Supabase project | Project id referenced in Navica docs: `ngovbzqutiiecgbzbyzx` (or current) |
| Vercel project | `summit-forge-re-os` (or rename later) |
| Domain (optional now) | `voxli.dev` or brokerage domain → Vercel DNS |
| Your email for admin user | Supabase Auth |

---

## 1. Apply database schema (order matters)

In **Supabase → SQL Editor**, run each file **in order**. All use `IF NOT EXISTS` / safe alters where possible.

| Step | File | Why |
|------|------|-----|
| 1 | `supabase/schema.sql` | Brokerages, profiles, alerts, matches, listings, transactions, baseline RLS |
| 2 | `supabase/schema-updates.sql` | Incremental table/column fixes |
| 3 | `supabase/schema-land-deals.sql` | Land deal digest persistence |
| 4 | `supabase/migrations/2026-07-17-add-visibility.sql` | **Critical** — without this, Navica upserts fail `42703` |
| 5 | `supabase/seed-archibald-bagley.sql` | Archibald-Bagley brokerage row + notes for linking your user |

**Verify in Table Editor:**

- [ ] `listings` has column `visibility`
- [ ] `brokerages` has row slug `archibald-bagley`
- [ ] RLS enabled on `listings`, `alerts`, `profiles`, `brokerages`, `transactions`

---

## 2. Vercel environment variables

**Production** (and Preview if you want previews non-demo):

| Variable | Production value | Notes |
|----------|------------------|--------|
| `NEXT_PUBLIC_DEMO_MODE` | `false` | **Required** — hides demo UI, enforces auth |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | real `pk.…` | Maps |
| `XAI_API_KEY` or `OPENAI_API_KEY` | real key | Prefer xAI/Grok |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://….supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | |
| `SUPABASE_SERVICE_ROLE_KEY` | service role | **Server only** — never `NEXT_PUBLIC_` |
| `CRON_SECRET` | `openssl rand -base64 32` | Secures hourly Navica cron |
| `NEXT_PUBLIC_COMPANY_NAME` | `Archibald-Bagley Real Estate` | First-paint brand |
| `NEXT_PUBLIC_BRAND_TAGLINE` | `Your Eastern Idaho Realtors` | |
| `NEXT_PUBLIC_BRAND_PHONE` | `(208) 745-5911` | |
| `NEXT_PUBLIC_BRAND_DOMAIN` | brokerage or `voxli.dev` | |
| `NEXT_PUBLIC_BRAND_PRIMARY` | hex e.g. `#1e3a5f` | Optional |
| `NAVICA_IDX_URL` / `NAVICA_API_KEY` | leave empty until Sprint 1 | Demo board OK for Sprint 0 only |
| `TWILIO_*` | leave empty until Sprint 3 | Simulated SMS OK for now |
| `STRIPE_*` | leave empty until Sprint 5 | Simulated checkout OK for now |

Redeploy after setting vars.

---

## 3. Create users

1. Supabase → **Authentication → Users → Add user**
2. Create your admin (email + password or magic link)
3. Create one agent test user
4. Run the profile link section in `seed-archibald-bagley.sql` (replace UUIDs)

Confirm:

- [ ] Visit production URL → redirected to `/login` (demo off)
- [ ] Sign in → dashboard loads
- [ ] Sign out works

---

## 4. Health & cron checks

```bash
# After deploy
curl -sS https://YOUR-PROD-HOST/api/health | jq .
```

Expect roughly:

```json
{
  "ok": true,
  "mode": "production",
  "readiness": { "score": 60, "grade": "partial", ... },
  "supabase": { "configured": true, "schemaOk": true, "hasVisibilityColumn": true },
  "navica": { "configured": false },
  "cron": { "secretConfigured": true }
}
```

- [ ] `ok: true` and `schemaOk: true`
- [ ] `mode: "production"`
- [ ] Manual cron dry-run (optional without Navica):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://YOUR-PROD-HOST/api/cron/sync-navica"
```

---

## 5. Local validation (optional)

```bash
cd SummitForge-RE-OS
git pull
npm ci
npm run validate:env
npm run prod:checklist   # prints Sprint 0 gate checklist
npm run typecheck
npm run build
NEXT_PUBLIC_DEMO_MODE=true npm run dev   # local preview still demos
```

---

## 6. Sprint 0 done checklist

| # | Gate | Owner |
|---|------|--------|
| 0.1 | All SQL applied; `visibility` present | Kipp |
| 0.2 | Vercel prod env set; `DEMO_MODE=false` | Kipp |
| 0.3 | Admin + 1 agent can log in | Kipp |
| 0.4 | Brand env = Archibald-Bagley first paint | Kipp |
| 0.5 | CI green on `main` | Repo / GitHub Actions |
| 0.6 | `/api/health` green; cron secret set | Kipp |

When all boxes are checked → **start Sprint 1** (Navica go-live) using `docs/NAVICA-GO-LIVE.md`.

---

## What this sprint does *not* include

- Live MLS credentials (Sprint 1)
- Moving CRM off localStorage (Sprint 2)
- Twilio SMS (Sprint 3)
- Stripe (Sprint 5)

Those are intentionally deferred so production foundations are solid first.
