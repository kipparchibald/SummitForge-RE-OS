# Summit Forge — Claude Context Pack

**Project:** Summit Forge  
**Owner:** Kipp Archibald (Archibald-Bagley Real Estate)  
**Goal:** Build a world-class, sellable real estate operating system for secondary markets (starting with Rigby/Jefferson County, Idaho). Designed to be white-labeled to other brokerages.

**Date:** July 7, 2026  
**Current Sprint:** Sprint 1 – Property Alerts + Matching Engine

---

## 1. Project Vision & Positioning

Summit Forge is being built as:

> **A modern, agent-first real estate operating system with strong brokerage oversight, powered by local data and community content — designed to be white-labeled and sold to other brokerages.**

### Key Strategic Pillars

- **Agent-First Experience**: Most daily tools are personalized and give agents strong control.
- **Brokerage Oversight Layer**: Managers get reporting, lead tracking, quality control, and visibility.
- **SMS-First Engagement**: Most of the database has phone numbers. Start with SMS notifications/marketing and use value to capture emails over time.
- **Multi-Tenant Architecture**: Built from the start to support multiple brokerages cleanly.
- **Local Hub Positioning**: Become the central information source for Rigby/Jefferson County (real estate + local news, high school sports, politics, community info). Strong SEO play.
- **Automated Data Priority**: Heavy focus on clean, automated IDX/Navica imports. Manual import as fallback.

---

## 2. Confirmed Strategic Decisions

| Decision | Choice | Notes |
|---------|--------|-------|
| **Primary User Model** | Agent-first + Brokerage oversight | Agents get powerful personal tools. Brokerages get reporting & control layer. |
| **Notifications** | SMS-first (phone numbers) | Capture emails over time by offering more features/benefits. |
| **White-label** | Multi-tenant from day one | Architecture must support multiple brokerages cleanly. |
| **Data Import** | Strong automated IDX/Navica feed | Manual import allowed but not preferred. |
| **Branding Tone** | Professional + Modern + Local | Also position as local community information hub. |

---

## 3. Current Folder Structure (Key Parts)

```
SummitForge-RE-OS/
├── app/
│   ├── alerts/           ← Currently being built (Sprint 1)
│   ├── analytics/        ← Most polished page
│   ├── cma/              ← Stub
│   ├── import/           ← Clean UI
│   ├── land/             ← Stub
│   ├── mortgage/         ← Fully functional
│   ├── layout.tsx        ← Sidebar navigation
├── components/
│   ├── PriceTrendChart.tsx
├── lib/
│   ├── alerts/
│       ├── matching.ts   ← New matching engine
├── types/
│   ├── alerts.ts         ← Core data models
├── CLAUDE_CONTEXT.md     ← This file
├── package.json
```

---

## 4. Current State of Development

### Built & Functional
- **Analytics Dashboard** — Strong New Construction focus (Rigby/Ririe), Land trends, Market Health, interactive charts
- **Mortgage Calculator** — Fully working with live calculations
- **Property Alerts** — Functional create/edit/delete form + basic matching engine (just added)
- **Sidebar Navigation** — Clean multi-page structure
- **Data Models** — `Alert`, `Listing`, `AlertMatch` types defined

### In Progress (Sprint 1)
- Connecting matching engine to import flow
- In-app notification feed for matched listings
- Preparing for SMS notifications

### Planned / Stub
- CMA Builder
- Land Development tools
- Transaction Coordinator
- Client Portal
- Broker/Admin dashboard
- Community content hub (local news, sports, etc.)

---

## 5. Core Data Models (types/alerts.ts)

```ts
export interface Alert {
  id: string;
  userId: string;
  brokerageId: string;
  name: string;
  locations: Location[];
  minPrice?: number;
  maxPrice?: number;
  minAcres?: number;
  propertyTypes: PropertyType[];
  newConstructionOnly: boolean;
  notifyBy: ('email' | 'sms' | 'in-app')[];
  frequency: 'instant' | 'daily' | 'weekly';
  active: boolean;
  createdAt: string;
}

export interface Listing { ... }

export interface AlertMatch { ... }
```

---

## 6. Matching Engine (lib/alerts/matching.ts)

- `calculateMatchScore(alert, listing)` — Rule-based scoring (0–100)
- `findMatchesForListing(listing, alerts)`
- `findMatchesForAlerts(listings, alerts)`

Currently uses location, price, acres, property type, and new construction preference. Will be enhanced with AI scoring later.

---

## 7. Current Sprint Plan

**Sprint 1 Goal (July 6–17):** Make Property Alerts + Matching functional and useful.

**Key Deliverables for this sprint:**
- Fully working alert creation + management
- Matching engine connected to import process
- In-app notifications for matched listings
- Foundation ready for SMS notifications

---

## 8. How to Collaborate Effectively

When working with this context:

- **Focus on the current sprint** unless told otherwise.
- Prioritize **multi-tenant thinking** and **SMS-first** approach.
- Keep the **Agent-first + Broker oversight** balance in mind.
- When proposing changes, be specific about which file(s) need to be modified.
- If something requires a business decision from Kipp, flag it clearly.

---

## 9. Next Priorities (After Sprint 1)

1. Connect matching engine to Data Import flow
2. Build In-App + SMS notification system
3. Start Transaction Coordinator
4. Strengthen automated IDX/Navica import
5. Begin Broker/Admin dashboard (for oversight & reporting)

---

**End of Context Pack**

You now have a solid, up-to-date summary of Summit Forge. Use this when working with Claude. When you want implementation work done, come back to Grok.