# Voxli.dev RE OS — Build Status

**Product:** **Voxli.dev** — real estate operating system (land, development, brokerage, AI agents)  
**Repo:** `SummitForge-RE-OS` (historical path; user-facing brand is Voxli.dev)
**Stack:** Next.js 15 + Supabase + domain agents  

**Not this product:** IdeaSpeak (`ideaspeak-app`) is a separate voice-first *app builder*. Do not merge IdeaSpeak features or status into this repo.

**Last updated:** July 27, 2026

---

## Current Score: **9.1 / 10**

### Done recently
- **Jefferson owner-of-record** — Node TLS incomplete-chain fix for `gisportal.co.jefferson.id.us`; parcel select returns assessor OWNER, situs, legal acres (`lib/development/parcel.ts`)
- **Smoke suite** — 151 checks incl. live GIS ownership, offer, nurture SMS, realtime publish, 17 pages
- **Alerts notifyBy** — form ↔ `('sms'|'email'|'in-app')[]` type alignment; StatusTone re-export
- **Offer engine** — win-probability scoring (`/offer`)
- **Moxi polish** — CMA export PDF, portal showings, nurture panel, realtime + toasts
- **AI Plat optimizer** — max lots / min roads, double-loaded streets, zoning digest from GIS zone code
- **GIS → CMA** — select parcel → Send to CMA with aerial + assessor fields
- **Marketing Agent (approve → deploy)** — Fair Housing checklist, human gate
- **CMA / CRM / Analytics / Land** — core brokerage loop live

### Verified (this loop)
| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `SMOKE_BASE_URL=http://localhost:3000 npm run test:smoke` | **151 passed, 0 failed** |
| GIS Rigby point | Owner + address from Jefferson assessor |
| GIS PIN RP04N34E360000 | STATE OF IDAHO · legal 560 ac |
| Feature pages + land-scan + analyze + concept plat | 200 / OK |

### Next (this repo only)
1. Navica IDX live credentials for production board
2. Twilio for live nurture SMS (simulated today)
3. Stripe Checkout sessions (replace demo subscribe buttons)
4. CRM → Supabase multi-tenant contacts (today: localStorage)
5. Upstream: Jefferson GIS full LE cert chain (workaround in place)

---

## Boundaries

| | SummitForge | IdeaSpeak |
|--|-------------|-----------|
| Purpose | RE OS for land / deals / brokerage | Build any app by voice with Grok |
| Repo | `SummitForge-RE-OS` | `ideaspeak-app` |
| Work here? | Yes | No — open that repo |

When an agent or human is in this workspace, only change SummitForge.
