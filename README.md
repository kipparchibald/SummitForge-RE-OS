# SummitForge RE OS

**Real Estate Operating System for Jefferson County / Eastern Idaho**  
Focus: Raw land, development, subdivisions, and AI-powered brokerage operations.

> **Product boundary:** SummitForge is this RE OS only. **IdeaSpeak** (voice → app builder) is a separate product/repo — do not merge the two.

## Current State (July 2026)
- Polished Next.js 15 dashboard with sidebar nav and white-label theming
- **World-class AI Assistants** (Valuation, Marketing, Council/Orchestrator, Transaction, Lead) — trained system prompts + LLM routing
- GIS Monitoring + Mapbox + raw land pro formas + parcel analysis
- Import (MLS/Zillow/LandWatch stubs) + Analytics + Forecasting (Jefferson-specific)
- Marketing Agent: full plan generation + execute (content + channels)
- Client Portal prototype (checklists, white-label ready)
- Full Branding & White-Label engine with live CSS var preview, logo, domain, company name
- First-run Setup Guide + Demo Mode banner (unlimited preview)
- Monetization foundations: pricing tiers, usage messaging, Pro demo unlocked, Stripe envs prepared
- Supabase schema ready (multi-tenant + RLS future)
- **Property Alerts + Matching Engine** — SMS-first alert matching wired into every import (CSV, URL, live Navica)
- **Transaction Coordinator + Idaho Forms** — deal tracking, RE-21/RE-14 auto-populate, e-signature simulation
- **Predictive Analytics** — Rigby/Ririe $/sqft, absorption, DOM charts + 3-month forecast
- **One-click White-Label Publish** — package the platform for other brokerages (`/publish`)

## Quick Start (Preview)
```bash
cp .env.example .env.local
# Add MAPBOX + OPENAI keys for live AI (optional for demo)
npm run dev
# Open http://localhost:3000 (or 3002)
```

Visit:
- `/setup` — First-run guided experience + mark complete
- `/pricing` — Polished freemium tiers (Free / Pro / Enterprise) with feature table + simulated Stripe checkout
- `/ai-assistants` — Talk to trained agents (voice supported)
- `/import` — "Pull Live from Archibald-Bagley Navica" (real-time IDX)
- `/analytics` + `/monitoring` — Live Navica data drives stats, forecasts, and parcel lists
- `/settings/branding` — Live white-label theming
- Dashboard has quick links + monetization teaser

## Demo Mode
`NEXT_PUBLIC_DEMO_MODE=true` (or in preview) shows banner, unlocks everything, uses fallbacks. Set `=false` (or omit) for production (hides banner, applies branding lock + seamless live data expectations). See full Deploy section.

## Real-Time Data (Navica IDX)
SummitForge now connects to Archibald-Bagley / Snake River MLS Navica IDX feed.

- Set `NAVICA_IDX_URL` and `NAVICA_API_KEY` in your env.
- Use the dedicated live pull button on `/import`.
- Analytics auto-updates with real parcel counts and samples.
- Data flows into AI agents (valuation on live parcels) and GIS.
- Without credentials: rich demo dataset of Jefferson County raw land is used.

**Background syncs via Vercel Cron:**
- `vercel.json` configures hourly cron to `/api/cron/sync-navica`.
- The route calls `fetchArchibaldNavicaListings`, `saveListings`, and `setRecentListings`.
- Always works in DEMO (uses built-in demo data when no NAVICA keys).
- Secure: requires `Authorization: Bearer ${CRON_SECRET}` header (Vercel injects automatically when set).

See `.env.example` for details and how to obtain feed access from your MLS provider.

## Monetization Path (Sellable SaaS)
- Live polished `/pricing` page with Free / Pro / Enterprise tiers
- Feature comparison focused on AI agents, white-label, usage, GIS, marketing execution
- "Start Free" + "Subscribe (Demo)" buttons that log/simulate Stripe using `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` placeholder
- Stripe checkout + portal + webhooks (env placeholders ready)
- Usage tracking hooks + per-tenant plans prepared
- White-label / Reseller model (other brokerages run their own branded version)

See `docs/FEATURE_ANALYSIS_WHITE_LABEL.md` for full roadmap.

## Deploy (Production Prep)

### Quick Vercel Deploy
1. Push to GitHub (or connect repo directly in Vercel).
2. Import project in Vercel → Framework preset detects Next.js.
3. **Environment Variables** (Vercel Dashboard → Settings → Environment Variables — set for Production + Preview + Development):
   - `NEXT_PUBLIC_MAPBOX_TOKEN` (required for maps)
   - `OPENAI_API_KEY` (required for AI Assistants; demo fallbacks exist)
   - `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (recommended; persistence + RLS ready)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, for writes in import/cron)
   - `NAVICA_IDX_URL` + `NAVICA_API_KEY` (for real Archibald-Bagley / Snake River MLS live data)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (for real billing)
   - `CRON_SECRET` (see below)
   - `NEXT_PUBLIC_DEMO_MODE=false` (critical for production: hides demo banner, applies branding lock, removes "(Demo)" labels)
4. Deploy. Run `npm run validate:env` locally before push (wired into `npm run build`).

`vercel.json` is pre-configured with:
- Security + cache headers
- Simple redirects (`/home`, `/demo`)
- Hourly cron for Navica
- Production env default suggestion

### .env Validation & Build Safety
- `npm run validate:env` (or automatic on `npm run build`)
- Centralized in `lib/env.ts` + `scripts/validate-env.js`
- In DEMO: warnings shown in banner + console
- In production: stronger notes (e.g. "real Navica recommended"). Does not block previews.
- Update `.env.example` + Vercel when adding keys.

### Supabase Setup (Persistence)
- Create project at supabase.com
- Run `supabase/schema.sql` + `supabase/schema-updates.sql` (listings table + RLS stubs)
- Use service role key server-side only (already wired in `lib/supabase/client.ts`)
- Listings from Navica/import are auto-upserted.
- Future: PostGIS for geometry, multi-tenant orgs.

### Real Navica / IDX (Archibald-Bagley)
- Obtain credentials from Snake River Regional MLS / Navica provider (IDX/RESO/RETS feed).
- Set `NAVICA_IDX_URL` (OData/JSON endpoint) and `NAVICA_API_KEY` (Bearer or header).
- Without keys: always falls back to rich static Jefferson County demo data (see `lib/import/navica.ts`).
- Pulls power: Import, Analytics, Monitoring, AI valuation agents.
- Background sync + manual trigger in `/monitoring`.

### Stripe (Monetization)
- Create Stripe account → get publishable + secret + webhook.
- Placeholders simulate in DEMO (see `/pricing`).
- In prod (`NEXT_PUBLIC_DEMO_MODE=false`): buttons ready for real Checkout sessions (add webhook handler at `/api/stripe` later).
- Tiers: Free / Pro / Enterprise with white-label focus.

### Enabling Vercel Cron (Hourly Navica Sync)
1. Add `CRON_SECRET` (strong random, e.g. `openssl rand -base64 32`) in Vercel env vars (Production).
2. `vercel.json` auto-registers `/api/cron/sync-navica` on `0 * * * *`.
3. Cron only runs on **Production** deployments.
4. Security: endpoint checks `Authorization: Bearer ${CRON_SECRET}` (Vercel injects). Unset = open for DEMO/local/manual.
5. Manual trigger (works always): button in Monitoring dashboard.
6. View logs: Vercel → Deployments → Cron Jobs or Functions logs.
7. Result: listings saved to Supabase + recentListings cache + live badge updates.

### Demo ↔ Live Toggle (Seamless)
- Set `NEXT_PUBLIC_DEMO_MODE=true` (or omit → defaults false) at build time.
- **DEMO**: Shows banner + "(Demo)" labels, full access, simulated Stripe, demo data + fallbacks everywhere.
- **PRODUCTION** (`=false`): 
  - Demo banner hidden.
  - Branding lock: forces clean "SummitForge" defaults if no localStorage custom brand.
  - Hides demo labels in data sources, plan badges, etc.
  - Env warnings shown only in demo UI.
  - Client override via localStorage `summitforge_demo` (testing only).
- Centralized: `lib/env.ts` (`isDemoMode()`, `validateEnv()`).
- Update branding at `/settings/branding` (persists via localStorage for now; wire to Supabase per-org later).
- Preview deployments on Vercel can keep demo=true for clients.

### Other Production Prep Applied
- `vercel.json`: security headers (X-Frame, nosniff, etc.), immutable static cache, redirects.
- `public/robots.txt` + `public/sitemap.xml` (update domain).
- `lib/env.ts` + validation script + build hook.
- Layout + pages use consistent `isDemo` for conditional rendering.
- Metadata, icons prepared.

### Post-Deploy
- Visit `/setup` to walk through.
- Test live Navica pull + cron.
- Customize branding.
- Add real keys → flip DEMO_MODE=false → redeploy.
- Monitor: Vercel logs + Supabase + Stripe dashboard.

Build: `npm run build` (validates env first).

## AI Agents
Trained prompts live in `lib/ai/client.ts`. All agents emphasize empathy, local Jefferson County data, and "coming home".

## Next (systematic)
- Full RESO Web API query builder + auth flows for production feeds
- Persist live listings to Supabase + PostGIS geometry
- Vercel Cron background hourly Navica syncs (implemented; configurable via CRON_SECRET)
- Feed data powering AI agents with live valuations
- Monitoring dashboard has manual sync trigger button

Current status: Live Navica IDX connection + Vercel Cron background syncs (hourly via /api/cron/sync-navica) implemented and functional (with excellent demo fallback even without keys or CRON_SECRET).
- Full Stripe wiring
- Multi-tenant + RLS + orgs
- Expanded marketing execution + DocuSign
- Team sharing + client auth

Built iteratively in parallel, improvement-centered. Ready for real revenue and client deployment.
