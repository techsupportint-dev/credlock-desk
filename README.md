# CredLock Technical Support Desk

Vite + vanilla JS + Supabase. Sidebar layout, Chart.js KPI charts, tickets, officers, SLA, incidents, device ops, reports.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with Supabase URL + anon key
npm run dev
```

## Migrations (run in order in Supabase SQL Editor)

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_seed_kavro.sql`
3. `supabase/migrations/003_enterprise_support.sql`
4. `supabase/migrations/004_officer_dept_features.sql`
5. `supabase/migrations/005_full_support_modules.sql`

See **SYNC.md** if `src/app.js` is missing after clone.
