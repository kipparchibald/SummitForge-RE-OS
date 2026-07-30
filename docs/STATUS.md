# Voxli.dev RE OS — Build Status

**Product:** **Voxli.dev** — real estate operating system (land, development, brokerage, AI agents)  
**Repo:** `SummitForge-RE-OS` (historical path; user-facing brand is Voxli.dev)
**Stack:** Next.js 15 + Supabase + domain agents  

**Not this product:** IdeaSpeak (`ideaspeak-app`) is a separate voice-first *app builder*. Do not merge IdeaSpeak features or status into this repo.

**Last updated:** July 30, 2026

---

## Current Score: **9.1 / 10** (demo) → **Sprint 0 in progress** for production

### Done recently (through July 27)
- **Jefferson owner-of-record** — Node TLS incomplete-chain fix for `gisportal.co.jefferson.id.us`
- **Smoke suite** — 151 checks
- **Offer engine** — win-probability scoring (`/offer`)
- **Moxi polish** — CMA export PDF, portal showings, nurture panel, realtime + toasts
- **AI Plat optimizer**, **GIS → CMA**, **Marketing Agent (approve → deploy)**

### Sprint 0 production foundations (July 30)
- `docs/SPRINT_0_RUNBOOK.md` — ops checklist for Supabase + Vercel + users
- `docs/SPRINT_PRODUCTION.md` — full 0–6 sprint board
- `supabase/APPLY_ORDER.md` + `seed-archibald-bagley.sql`
- Stricter `validateEnv` + `/api/health` readiness score/gates
- `npm run prod:checklist`
- robots/sitemap pointed at **voxli.dev**

### Verified (July 27 loop)
| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `SMOKE_BASE_URL=http://localhost:3000 npm run test:smoke` | **151 passed, 0 failed** |
| GIS Rigby point | Owner + address from Jefferson assessor |

### Next (ordered)
1. **You (ops):** Run Sprint 0 runbook SQL + Vercel env + create users  
2. **Sprint 1:** Navica IDX live credentials + backfill (`docs/NAVICA-GO-LIVE.md`)  
3. Twilio for live nurture SMS  
4. CRM → Supabase multi-tenant contacts (today: localStorage)  
5. Stripe Checkout sessions  

---

## Boundaries

| | SummitForge / Voxli RE OS | IdeaSpeak | Split Rock / Voxli construction |
|--|--------------------------|-----------|----------------------------------|
| Purpose | RE OS land / deals / brokerage | Build any app by voice | GC job cost / portal |
| Repo | `SummitForge-RE-OS` | `ideaspeak-app` | `Voxli` / `split-rock-construction` |
| Work here? | Yes | No | No |
