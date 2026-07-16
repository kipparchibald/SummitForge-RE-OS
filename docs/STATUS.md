# SummitForge RE OS — Build Status

**Product:** Real estate operating system (land, development, brokerage, AI agents)  
**Repo:** `SummitForge-RE-OS` only  
**Stack:** Next.js 15 + Supabase + domain agents  

**Not this product:** IdeaSpeak (`ideaspeak-app`) is a separate voice-first *app builder*. Do not merge IdeaSpeak features or status into this repo.

**Last updated:** July 16, 2026

---

## Current Score: **5.5 / 10**

### Done recently
- **Merged `feature/land-development-engine` into `main`** — the two lines had diverged since July 3; both feature sets now live together
- Land feasibility + comps-driven plat engine (`/development/land-deals`)
- Live Navica/MLS import + Supabase persistence + hourly cron sync
- AI assistant agents (Valuation, Marketing, Council, Transaction, Lead)
- Security fixes: fail-closed cron auth, SSRF guard on import, escaped digest email
- Alert matching engine now runs on every import path (CSV, URL, live Navica)
- Client portal with voice AI, Idaho forms + e-sign, predictive charts, publish flow

### Next (this repo only)
1. Branding theme variables end-to-end
2. Analytics UI consistency
3. Real Navica credentials + production Supabase
4. Replace demo stats on dashboard with live queries

---

## Boundaries

| | SummitForge | IdeaSpeak |
|--|-------------|-----------|
| Purpose | RE OS for land / deals / brokerage | Build any app by voice with Grok |
| Repo | `SummitForge-RE-OS` | `ideaspeak-app` |
| Work here? | Yes | No — open that repo |

When an agent or human is in this workspace, only change SummitForge.
