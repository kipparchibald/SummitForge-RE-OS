# Voxli.dev RE OS — Build Status

**Product:** **Voxli.dev** — real estate operating system (land, development, brokerage, AI agents)  
**Repo:** `SummitForge-RE-OS` (historical path; user-facing brand is Voxli.dev)
**Stack:** Next.js 15 + Supabase + domain agents  

**Not this product:** IdeaSpeak (`ideaspeak-app`) is a separate voice-first *app builder*. Do not merge IdeaSpeak features or status into this repo.

**Last updated:** July 30, 2026


**Production:** [summit-forge-re-os-voxli.vercel.app](https://summit-forge-re-os-voxli.vercel.app) · Vercel `voxli/summit-forge-re-os` · brand **Voxli.dev**  
**Ops status:** Production ready (confirmed by owner). See `docs/DEPLOYMENT.md`.


---

## Current Score: **9.4 / 10** product · **Production ready** (ops)

### Done recently (July 30 — Sprint 2 durable CRM / alerts)
- **Shared cookie session client** — CRM + alerts now use `getBrowserSupabase()` (`@supabase/ssr`) so login sessions actually reach dual-stores (was broken with raw `createClient`)
- **Brokerage slug resolution** — writes stamp `brokerage_id` from `profiles` → `brokerages.slug`
- **Tenant RLS migration** — `supabase/migrations/2026-07-30-sprint2-tenant-rls.sql` (desk isolation by brokerage; admin/broker override)
- **Nurture enrollments** dual-store + cloud upsert on enroll
- **CRM UI** — storage badge, delete contact, “Sync device → cloud”
- **Alerts UI** — storage badge + cloud migrate CTA
- **Health** — `gates.crmSchemaOk` + table presence diagnostics

### Done recently (July 30 — polish / security pass)
- **Next.js 15.5.22** — App Router Server Actions DoS patch
- **Security headers** — CSP, XFO DENY, nosniff, COOP/CORP, Permissions-Policy
- **API hardening** — rate limits (AI, SMS, import, realtime), JSON body size caps, E.164 SMS validation, SSRF checks on import URLs
- **UI polish** — Inter font, focus-visible, reduced-motion, brand default tokens, tighter chrome
- **Perf** — `optimizePackageImports` for Mapbox, static cache headers, `poweredByHeader: false`

### Sprint 0 production foundations (July 30)
- `docs/SPRINT_0_RUNBOOK.md` — ops checklist for Supabase + Vercel + users
- `docs/SPRINT_PRODUCTION.md` — full 0–6 sprint board
- `supabase/APPLY_ORDER.md` + `seed-archibald-bagley.sql`
- Stricter `validateEnv` + `/api/health` readiness score/gates
- `npm run prod:checklist`
- robots/sitemap pointed at **voxli.dev**

### Next (ordered)
1. **Owner:** run Sprint 2 SQL on prod Supabase (APPLY_ORDER steps 5–7)  
2. **Sprint 1:** Navica IDX live credentials when SRMLS delivers  
3. **S2.6** Tenant switcher UI + isolation tests  
4. Twilio live nurture SMS  
5. Stripe Checkout sessions  

---

## Boundaries

| | SummitForge / Voxli RE OS | IdeaSpeak | Split Rock / Voxli construction |
|--|--------------------------|-----------|----------------------------------|
| Purpose | RE OS land / deals / brokerage | Build any app by voice | GC job cost / portal |
| Repo | `SummitForge-RE-OS` | `ideaspeak-app` | `Voxli` / `split-rock-construction` |
| Work here? | Yes | No | No |
