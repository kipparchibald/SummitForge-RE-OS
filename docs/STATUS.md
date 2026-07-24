# SummitForge RE OS — Build Status

**Product:** Real estate operating system (land, development, brokerage, AI agents)  
**Repo:** `SummitForge-RE-OS` only  
**Stack:** Next.js 15 + Supabase + domain agents  

**Not this product:** IdeaSpeak (`ideaspeak-app`) is a separate voice-first *app builder*. Do not merge IdeaSpeak features or status into this repo.

**Last updated:** July 24, 2026

---

## Current Score: **8.9 / 10**

### Done recently
- **AI Plat optimizer** — max lots / min roads, double-loaded streets, zoning digest from GIS zone code, nearby subdivision pattern scan (`lib/development/plat-geometry.ts`, `zoning.ts`, `comps-design.ts`)
- **GIS → CMA** — select parcel on `/monitoring` → **Send to CMA** applies year built, assessed/land/improvement values, owner, situs, acres, improvements + aerial parcel map; residential auto-classified when DWELL / improvement value present (`lib/cma/from-gis.ts`)
- **Marketing Agent (approve → deploy)** — autonomous campaign builder with Fair Housing checklist, channel budgets, creatives, calendar, KPI targets; human gate before deploy (`/marketing`)
- **AI Plat Studio** (`/development/plat`) — flagship feasibility + SVG plat + AI notes; concept geometry when GIS unavailable
- **CMA Builder** (live) — adjusted weighted comps, Navica pull, AI valuation assist, GIS subject panel (`lib/cma/engine.ts`)
- **CRM Pipeline** (`/crm`) — stages, AI lead qualify, local persistence, links to CMA/plat/transactions
- **Analytics polish** — honest listing counts (no fake 12k), forecast on mount, land deal CTAs
- **GIS Monitoring polish** — Navica pins, feasibility cards, embedded DevelopmentPotential + plat
- **Nav priority** — AI Plat, Land Deals, GIS, Analytics, CRM, CMA, Marketing Agent at top of sidebar
- Dark Command Center, mobile nav, land deals filters, expanded smoke tests, build hygiene
- Land feasibility engine, Navica import, AI agents, alert matching, portal, forms, publish

### Verified (this loop)
| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `npm run test:smoke` | Pass (CMA + concept plat + feature pages) |
| `npm run build` | Pass |
| `/cma` `/crm` `/development/plat` `/analytics` `/monitoring` | 200 |
| `/api/development/analyze` + concept `/api/development/plat` | OFFER + SVG |

### Next (this repo only)
1. Wire real `OPENAI_API_KEY` + Navica credentials for production intelligence
2. Stripe Checkout sessions (replace demo subscribe buttons)
3. CRM → Supabase multi-tenant contacts (today: localStorage)
4. Mapbox token for full GIS map in deploy

---

## Boundaries

| | SummitForge | IdeaSpeak |
|--|-------------|-----------|
| Purpose | RE OS for land / deals / brokerage | Build any app by voice with Grok |
| Repo | `SummitForge-RE-OS` | `ideaspeak-app` |
| Work here? | Yes | No — open that repo |

When an agent or human is in this workspace, only change SummitForge.
