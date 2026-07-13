# SummitForge RE OS

**The modern real estate operating system for secondary markets.**

Built for Archibald-Bagley Real Estate (Rigby / Jefferson County, Idaho) and designed from day one as a white-label platform other brokerages can run.

> Agent-first tools + brokerage oversight + local intelligence + AI agents.

---

## Vision

SummitForge is a full real estate OS that combines:

- **Analytics** — New construction pricing (Rigby/Ririe focus), land development potential, market health
- **Property Alerts** — AI matching + SMS-first notifications
- **Transaction tools** — Coordinator, Idaho forms, checklists
- **CMA & Valuation** — Smart comps + investment pro formas
- **Marketing Agent** — Content + campaign planning
- **GIS & Development** — Monitoring, preliminary plats, lot yield
- **Mortgage Calculator**
- **White-label branding** — Multi-tenant ready

**Target users**: Individual agents & teams first, with strong brokerage reporting layer on top.

---

## Current Status (July 2026)

| Area | Status |
|------|--------|
| Analytics Dashboard | Strong (New Construction + Land + Market Health) |
| Property Alerts + Matching Engine | Functional foundation |
| Mortgage Calculator | Complete |
| Marketing Agent | In progress |
| Transaction Coordinator | Stub + foundation |
| CMA Builder | Stub |
| Land Development tools | Stub |
| Multi-tenant / White-label | Architecture planned, branding page started |
| Client Portal | Not started |
| Automated IDX/Navica import | Import UI + matching ready |

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (Postgres + PostGIS + RLS)
- **Maps**: Mapbox
- **UI**: Tailwind + (planned) shadcn/ui
- **AI**: Custom multi-agent system (Council, Valuation, Marketing, etc.)
- **Forms**: Idaho REALTOR forms integration

---

## Getting Started

```bash
git clone https://github.com/kipparchibald/SummitForge-RE-OS.git
cd SummitForge-RE-OS
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create a `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
# Future: TWILIO_*, DOCUSIGN_*, XAI_API_KEY
```

---

## Project Structure

```
app/
  analytics/     # Main dashboard (New Construction, Land, Market Health)
  alerts/        # Property Alerts + matching UI
  mortgage/      # Mortgage calculator
  import/        # Navica / MLS import
  cma/           # CMA Builder (stub)
  land/          # Land Development tools (stub)
  marketing/     # Marketing agent
  monitoring/    # GIS monitoring
  settings/      # Branding & white-label
lib/
  alerts/        # Matching engine
  ai/            # Multi-agent system
  forms/         # Idaho forms
  import/        # Listing normalizer
  marketing/     # Marketing agent
  transaction/   # Coordinator
types/
  alerts.ts      # Core data models
```

---

## Strategic Pillars

1. **Agent-First** — Powerful personal tools
2. **Brokerage Oversight** — Reporting, lead tracking, quality control
3. **SMS-First** — Phone numbers are primary; capture email over time
4. **Multi-Tenant** — White-label from day one
5. **Local Hub** — Rigby / Jefferson County intelligence + community content
6. **Automated Data** — Strong IDX/Navica focus

---

## Roadmap (High Level)

**Now → Internal MVP**
- Complete Alerts end-to-end (match on import + notifications)
- Full Transaction Coordinator
- Working multi-tenant foundation + branding
- Solid README + deploy pipeline

**Next → White-label Beta**
- Tenant theming + custom domains
- Broker/Admin dashboard
- Client portal
- Billing stubs

**Later → SaaS**
- Reseller portal
- Marketplace of add-ons
- Full CRM + marketing automation

---

## Related Projects

- [IdeaSpeak](https://github.com/kipparchibald/ideaspeak-app) — Voice-first xAI app builder (sister project)

---

## License

Private / All rights reserved (Archibald-Bagley). Contact for white-label inquiries.

---

*Built for Rigby. Ready for the rest of Eastern Idaho and beyond.*
