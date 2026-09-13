# RISE parity plan — phases 0–3 (SummitForge / Voxli RE OS)

**Product:** Archibald-Bagley Real Estate · Jefferson County / Eastern Idaho  
**Reference:** MoxiWorks RISE-style pipeline AI (job, not brand)  
**Scope lock:** Phases 0–3 only. No second CRM, no auto-send, no recruiting/coaching clone.

Updated: 2026-08-29

---

## What RISE does (job to match)

| Capability | RISE-style behavior |
|------------|---------------------|
| **Pipeline signal** | Rank contacts by intent from activity (views, showings, stage, recency). |
| **Contact 360** | One panel: timeline, score + why, showings, nurture, alerts, related deals. |
| **Today queue** | Top N “don’t miss” contacts with reason, Act / Snooze / Dismiss. |
| **Drafted outreach** | SMS-first drafts; agent approves before anything sends. |
| **Auto-send** | Sequences fire without per-touch approval. **Out of scope (phase 4+).** |

---

## What this repo already has

### CRM core (`app/crm`, `lib/crm`, `supabase/schema-crm.sql`)

| Asset | Status | Notes |
|-------|--------|-------|
| `crm_contacts` | ✅ | `score`, `stage`, `brokerage_id`, `phone`, `email`, `areas`, `notes` |
| Dual-store | ✅ | `lib/crm/supabase-store.ts` — localStorage + Supabase when signed in |
| Stages | ✅ | lead → qualified → nurture → active → under_contract → closed / lost |
| Demo contacts | ✅ | Eastern Idaho areas (Rigby, Rexburg, Jefferson) in `lib/crm/store.ts` |
| AI qualify | ✅ | `/api/ai/lead` bumps score + stage from CRM detail |
| Open deal | ✅ | `openDealFromContactWithToast` → `/transactions` with `contact_id` |

### Nurture (`lib/nurture`, `components/crm/NurturePanel.tsx`)

| Asset | Status | Notes |
|-------|--------|-------|
| Sequences | ✅ | SMS-first copy, Archibald-Bagley voice in `lib/nurture/sequences.ts` |
| Enrollments | ✅ | `nurture_enrollments` table + dual-store |
| SMS outbox | ✅ | `lib/nurture/sms.ts` → `/api/nurture/send-sms` (Twilio or simulated) |
| Auto-send | ⚠️ | Infra exists; **no cron/auto-fire in this sprint** — approve-only for RISE loop |

### Showings (`components/crm/ShowingInbox.tsx`, `showing_requests`)

| Asset | Status | Notes |
|-------|--------|-------|
| Portal → inbox | ✅ | Client portal schedules; agent confirms/declines in CRM |
| Contact link | ❌ | Showings keyed by `match_id` / address, not `contact_id` — match heuristically in 360 |

### Alerts (`lib/alerts`, `app/alerts`)

| Asset | Status | Notes |
|-------|--------|-------|
| Matching engine | ✅ | `lib/alerts/matching.ts` — location, price, acres, keywords |
| Dual-store | ✅ | `lib/alerts/supabase-store.ts` |
| Rematch → portal | ✅ | Documented in `docs/STATUS_MOXI_POLISH.md` |
| Contact link | ❌ | Alerts are buyer-centric by `user_id`, not CRM `contact_id` — count desk matches for signal |

### Transactions (`app/transactions`, `lib/transaction`)

| Asset | Status | Notes |
|-------|--------|-------|
| Deal files | ✅ | Checklist, coordinator, cloud sync |
| `contact_id` | ✅ | `schema-transactions-extend.sql` — deals opened from CRM carry link |
| Intent signal | ✅ (phase 1) | Active non-closed tx for contact boosts score |

### CMA / Marketing (`app/cma`, `app/marketing`)

| Asset | Status | Notes |
|-------|--------|-------|
| CMA builder | ✅ | PDF export, GIS handoff |
| Marketing agent | ✅ | Campaign briefs, approval workflow for *campaigns* |
| Contact link | ❌ | No `contact_id` on CMA/marketing rows — name/area heuristics only in 360 |

### Tenant / RLS

| Asset | Status | Notes |
|-------|--------|-------|
| Org model | ✅ | `brokerages` + `profiles.brokerage_id` (UUID); CRM uses `brokerage_id` **slug** text |
| Seed tenant | ✅ | `archibald-bagley` UUID `a0000000-0000-4000-8000-000000000001` |
| RLS helpers | ✅ | `user_brokerage_slug()`, `user_is_admin()` in `FIX_RLS_PASTE_THIS.sql` |
| CRM RLS in repo SQL | ⚠️ | `schema-crm.sql` still had `USING (true)` — **tightened in phase 1** to match FIX_RLS |

No separate `organizations` table — **use existing `brokerage_id` slug; do not add `org_id`.**

---

## Gaps — phases 0–3 vs later

### In scope (this PR)

| Gap | Phase | Resolution |
|-----|-------|------------|
| Honest parity doc | 0 | This file |
| Intent writes to `crm_contacts.score` | 1 | `lib/crm/intent.ts` + columns `last_touched_at`, `intent_reason`, `snoozed_until`, `dismissed_at` |
| Contact 360 panel | 1 | `components/crm/Contact360.tsx` on existing CRM selection |
| `/today` top-5 queue | 2 | `app/today/page.tsx` — Act / Snooze (tomorrow 8am Boise) / Dismiss (until re-touch) |
| `/inbox` drafts | 3 | SMS primary, email secondary; Approve records intent; send gated by env |
| Nav links | 2–3 | Pipeline group: Today, Inbox |
| Brokerage RLS on new tables | 1–3 | `crm_outreach_drafts` + updated `schema-crm.sql` policies |

### Out of scope (phase 4+)

- Auto-send nurture sequences / Twilio blast without per-message Approve  
- Recruiting, roster coaching, brokerage-wide AI manager  
- MoxiWorks/RISE trademarks or pixel-perfect UI clone  
- Live MLS listing invention (Adair ghosts, fake addresses)  
- Second contacts table (`crm_people`, `rise_contacts`)  
- `kipparchibald.com` / public IDX repo changes  

---

## Architecture decision

**Extend `crm_contacts` and existing stores — do not fork a new CRM.**

```
Portal / Alerts ──┐
Nurture / Showings├──► lib/crm/intent.ts ──► crm_contacts.score + intent_reason
Transactions ─────┘              │
                                 ▼
                    /today (rank) ──► Act ──► /inbox (draft) ──► Approve (no send by default)
                                 │
                                 └──► Contact 360 (existing /crm selection)
```

- **SMS-first:** drafts default to short text; email is secondary tab in inbox.  
- **Approve-only:** `OUTBOUND_APPROVE_SEND` must be `true` *and* explicit Approve body flag for real Twilio; default is record-only.  
- **Copy:** Archibald-Bagley, Jefferson County cities (Rigby, Rexburg, Idaho Falls, Ammon).

---

## Apply order (new SQL)

After existing steps in `supabase/APPLY_ORDER.md`:

| Order | File | Purpose |
|------:|------|---------|
| 10 | `migrations/2026-08-29-rise-intent-columns.sql` | Intent columns + `crm_outreach_drafts` + brokerage RLS |

Re-run `FIX_RLS_PASTE_THIS.sql` on production if policies drift.

---

## Verification checklist

1. `/crm` — select contact → Contact 360 shows score, why, timeline, showings, nurture, alerts count, linked tx  
2. `/today` — top 5 ranked; Snooze hides until tomorrow 8am `America/Boise`; Dismiss hides until note/stage touch  
3. `/inbox` — draft from Act; Approve does **not** send unless `OUTBOUND_APPROVE_SEND=true`  
4. Signed-in + RLS — agent only sees `archibald-bagley` rows (or their profile brokerage slug)  
5. `npm run typecheck` passes  

---

## Related docs

- `docs/STATUS_MOXI_POLISH.md` — shipped Moxi/Compass polish baseline  
- `supabase/FIX_RLS_PASTE_THIS.sql` — tenant policy reference  
- `AGENTS.md` — Voxli/SummitForge scope (not IdeaSpeak)
