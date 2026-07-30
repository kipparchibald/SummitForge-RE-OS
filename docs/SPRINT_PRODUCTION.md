# Voxli.dev RE OS — Production sprint board

**Product:** Voxli.dev (repo: SummitForge-RE-OS)  
**Strategy:** Ship Archibald-Bagley on production data + SMS first; white-label only after the desk runs on it daily.  
**Last updated:** 2026-07-30  

Do **not** merge IdeaSpeak or Split Rock Construction OS into this repo.

---

## North star (8 weeks)

Archibald-Bagley runs **live MLS + durable CRM + portal + SMS** on production; one external brokerage can trial white-label; Stripe path works.

---

## Sprint 0 — Production foundations (now)

See **[SPRINT_0_RUNBOOK.md](./SPRINT_0_RUNBOOK.md)**.

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

## Sprint 2 — Durable CRM + multi-tenant core

| ID | Work | Status |
|----|------|--------|
| S2.1 | contacts / pipelines / activities / showings tables + RLS | ✅ `schema-crm.sql` + `2026-07-30-sprint2-tenant-rls.sql` |
| S2.2 | CRM store → Supabase (off localStorage) | ✅ Dual-store + cookie session client |
| S2.3 | Alerts + matches fully server-persisted | ✅ Dual-store + migrate CTA + brokerage slug |
| S2.4 | Roles: agent / broker / admin | ✅ RLS `user_is_admin()`; seed profiles roles |
| S2.5 | Branding JSON on `brokerages` | ✅ Seed + deployment branding |
| S2.6 | Tenant switcher + isolation tests | ⬜ Partial — brokerage RLS live; switcher UI later |

**Apply on Supabase:** steps 5–7 in [APPLY_ORDER.md](../supabase/APPLY_ORDER.md).  
**Verify:** `/api/health` → `gates.crmSchemaOk` + `supabase.crm.tables`.

---

## Sprint 3 — Client nurture (SMS-first)

| ID | Work | Status |
|----|------|--------|
| S3.1 | Twilio prod + STOP/opt-in | ⬜ |
| S3.2 | Alert match → instant SMS | ⬜ |
| S3.3 | CRM nurture sequence scheduler | ⬜ Enrollments dual-store ready |
| S3.4 | Portal real auth (retire PIN `demo`) | ⬜ |
| S3.5 | Showing request → CRM + agent SMS | ⬜ Cloud showings inbox ready |
| S3.6 | Preference center | ⬜ |

---

## Sprint 4 — Transactions + forms

| ID | Work | Status |
|----|------|--------|
| S4.1 | Transactions + checklists on Supabase | ⬜ |
| S4.2 | RE-21 / RE-14 populate from deal | ⬜ Partial |
| S4.3 | Form Simplicity or DocuSign primary path | ⬜ |
| S4.4 | Critical dates + reminders | ⬜ |
| S4.5 | Transaction AI human-gate only | ⬜ |
| S4.6 | Audit log | ⬜ |

---

## Sprint 5 — Monetization + white-label

| ID | Work | Status |
|----|------|--------|
| S5.1 | Stripe Checkout + portal + webhooks | ⬜ |
| S5.2 | Plan entitlements | ⬜ |
| S5.3 | Usage meters | ⬜ |
| S5.4 | Publish + tenant onboarding wizard | ⬜ Partial UI |
| S5.5 | Branded emails/PDFs/SMS footer | ⬜ |
| S5.6 | Reseller onboarding docs | ⬜ |

---

## Sprint 6 — World-class polish

| ID | Work | Status |
|----|------|--------|
| S6.1 | Design system pass all routes | ⬜ Partial |
| S6.2 | Mobile / PWA agent flows | ⬜ |
| S6.3 | Performance listing + map queries | ⬜ |
| S6.4 | Public IDX-safe SEO pages | ⬜ |
| S6.5 | Playwright critical-path CI | ⬜ |
| S6.6 | Ops runbooks (outages) | ⬜ |
| S6.7 | Jefferson GIS cert chain (upstream) | ⬜ |

---

## Priority top 10

1. Apply Sprint 2 SQL (`schema-crm` + tenant RLS migration) on prod Supabase  
2. Confirm agents have `profiles.brokerage_id` → Archibald-Bagley  
3. Navica credentials + backfill  
4. Twilio live nurture  
5. Client portal real auth  
6. Stripe Checkout  
7. Tenant switcher UI (S2.6)  
8. White-label tenant #2  
9. Design system pass  
10. Playwright critical paths  
