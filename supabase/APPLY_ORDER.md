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
| 7 | `seed-archibald-bagley.sql` | First brokerage seed |

### After apply

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('crm_contacts', 'showing_requests', 'transactions');

select column_name from information_schema.columns
where table_name = 'transactions'
  and column_name in ('address', 'checklist', 'contact_id', 'is_land');
```

If `crm_contacts` is missing, CRM stays on localStorage only.  
If `contact_id` / `checklist` missing, deals still work locally; cloud sync may drop extra fields until extend SQL runs.
