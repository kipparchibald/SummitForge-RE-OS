# Supabase SQL apply order

Run in the **Supabase SQL Editor** for the **production** project (and preview DB if separate).

| Order | File | Required for |
|------:|------|----------------|
| 1 | `schema.sql` | Core multi-tenant + listings + RLS |
| 2 | `schema-updates.sql` | Follow-on columns / tables |
| 3 | `schema-land-deals.sql` | Land digest cron |
| 4 | `migrations/2026-07-17-add-visibility.sql` | Navica IDX/BBO gating — **must before live upserts** |
| 5 | `seed-archibald-bagley.sql` | First brokerage seed |

### After apply

```sql
-- Quick health queries
select column_name, data_type
from information_schema.columns
where table_name = 'listings' and column_name = 'visibility';

select id, name, slug from brokerages;
```

If `visibility` is missing, hourly cron and import will fail with Postgres `42703`.
