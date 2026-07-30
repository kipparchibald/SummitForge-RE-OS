# Voxli.dev RE OS — Production sprint board

**Product:** Voxli.dev (repo: SummitForge-RE-OS)  
**Strategy:** Ship Archibald-Bagley on production data + SMS first; white-label only after the desk runs on it daily.  
**Last updated:** 2026-07-30  

Do **not** merge IdeaSpeak or Split Rock Construction OS into this repo.

**Deploy identity:** see [DEPLOYMENT.md](./DEPLOYMENT.md) — Production ready on `summit-forge-re-os-voxli.vercel.app`.

---

## North star (8 weeks)

Archibald-Bagley runs **live MLS + durable CRM + portal + SMS** on production; one external brokerage can trial white-label; Stripe path works.

---

## Sprint 0 — Production foundations

| ID | Work | Status |
|----|------|--------|
| S0.1 | Apply Supabase schema + visibility migration | ✅ Owner: prod ready |
| S0.2 | Vercel prod env + `DEMO_MODE=false` | ✅ Owner: prod ready |
| S0.3 | Seed brokerage + admin/agent users | ✅ Owner: prod ready |
| S0.4 | Brand/SEO defaults (voxli.dev, AB branding env) | ✅ Code |
| S0.5 | CI build + typecheck | ✅ Exists |
| S0.6 | Health readiness score + prod checklist script | ✅ Code |

---

## Sprint 1 — Live data spine

| ID | Work | Status |
|----|------|--------|
| S1.1 | Navica credentials in Vercel **prod only** | ⬜ Blocked on SRMLS |
| S1.2 | Validate real `FeedTypes` → tighten `feedTypes.ts` | ⬜ |
| S1.3 | Overnight backfill + 48h green cron | ⬜ |
| S1.4 | Disable idx-site scraper when feed live | ⬜ Code guard when ready |
| S1.5 | Analytics / monitoring / AI use persisted listings only in prod | ⬜ |
| S1.6 | Seven-county spot check | ⬜ |

Runbook: [NAVICA-GO-LIVE.md](./NAVICA-GO-LIVE.md)

---

## Sprint 2 — Durable CRM + showings (in progress)

| ID | Work | Status |
|----|------|--------|
| S2.1 | `crm_contacts` / `showing_requests` / `nurture_enrollments` SQL + RLS | ✅ `schema-crm.sql` |
| S2.2 | CRM dual-store (local cache + Supabase when signed in) | ✅ `lib/crm/supabase-store.ts` |
| S2.3 | CRM page async load/save + storage mode badge | ✅ `/crm` |
| S2.4 | Showings portal → cloud + agent inbox | ✅ |
| S2.5 | Alerts dual-store already present | ✅ `lib/alerts/supabase-store.ts` |
| S2.6 | Roles: agent / broker / admin (RLS by brokerage claim) | ⬜ Later |
| S2.7 | Branding JSON on `brokerages` (not only localStorage) | ⬜ Later |

**You run once:** Supabase SQL Editor → `supabase/schema-crm.sql`  
Then sign in on prod → CRM header shows **Supabase (synced)**.

---

## Sprint 3 — Client nurture (SMS-first)

| ID | Work | Status |
|----|------|--------|
| S3.1 | Twilio prod + STOP/opt-in | ⬜ |
| S3.2 | Alert match → instant SMS | ⬜ |
| S3.3 | CRM nurture sequence scheduler | ⬜ |
| S3.4 | Portal real auth (retire PIN `demo`) | ⬜ |
| S3.5 | Showing request → CRM + agent SMS | ⬜ |
| S3.6 | Preference center | ⬜ |

---

## Sprint 4–6

See prior board entries: transactions/e-sign, Stripe/white-label, polish.

---

## Priority top 10 (remaining)

1. Apply `schema-crm.sql` on production Supabase  
2. Confirm CRM cloud badge when signed in  
3. Navica credentials + backfill  
4. Twilio live nurture  
5. Client portal real auth  
6. Transactions persisted + e-sign  
7. Stripe live  
8. Tenant #2 white-label trial  
9. Mobile polish + E2E CI  
10. RLS by brokerage_id claim  

---

## Explicit non-goals

- IdeaSpeak app builder  
- Voxli / Split Rock construction job OS  
- Native mobile apps before web PWA is excellent  
- Full Cesium / drone pipeline at launch  
