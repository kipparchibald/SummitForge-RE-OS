# Supabase SQL apply order

Run in the **Supabase SQL Editor** for the **production** project (and preview DB if separate).

| Order | File | Required for |
|------:|------|----------------|
| 1 | `schema.sql` | Core multi-tenant + listings + RLS + base `transactions` |
| 2 | `schema-updates.sql` | Follow-on columns / tables |
| 3 | `schema-land-deals.sql` | Land digest cron |
| 4 | `migrations/2026-07-17-add-visibility.sql` | Navica IDX/BBO gating — **must before live upserts** |
| 5 | `schema-crm.sql` | CRM contacts, showings, nurture enrollments |
| 6 | `schema-transactions-extend.sql` | Checklist, address, `contact_id` on deals |
| 7 | `migrations/2026-07-30-sprint2-tenant-rls.sql` | **Sprint 2** — tenant RLS, alert phone/email, `crm_activities` |
| 8 | `seed-archibald-bagley.sql` | First brokerage seed |
| 9 | `migrations/2026-08-04-emergency-enable-rls-all-public.sql` | **CRITICAL** — enable RLS on all public tables + revoke anon (Supabase security email) |
| 10 | `migrations/2026-08-29-rise-intent-columns.sql` | **RISE loop** — intent columns on `crm_contacts`, `crm_outreach_drafts`, brokerage RLS |

### After apply

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'crm_contacts', 'showing_requests', 'nurture_enrollments',
    'crm_activities', 'alerts', 'alert_matches', 'transactions'
  );

select column_name from information_schema.columns
where table_name = 'alerts' and column_name in ('phone', 'email');

select column_name from information_schema.columns
where table_name = 'transactions'
  and column_name in ('address', 'checklist', 'contact_id', 'is_land');

-- Optional: confirm helper exists
select public.user_brokerage_slug();
```

### Client behavior

| State | CRM / Alerts |
|-------|----------------|
| No Supabase / signed out | localStorage dual-store (demo works) |
| Signed in + tables applied | Cookie session client writes `crm_contacts` / `alerts` with brokerage slug |
| Tables missing | UI stays on “This device only”; `/api/health` → `crm.ok: false` |

If `crm_contacts` is missing, CRM stays on localStorage only.  
If `contact_id` / `checklist` missing, deals still work locally; cloud sync may drop extra fields until extend SQL runs.

### Sprint 2 tenant isolation

After step 7, row policies scope CRM/alerts/showings/nurture to  
`brokerage_id = public.user_brokerage_slug()` (from `profiles` → `brokerages.slug`).  
Admins/brokers (`profiles.role in ('admin','broker')`) retain desk-wide access.
