# CredLock Support Desk + Kavro Tracker

Modern Vite + Supabase technical support platform for CredLock Africa.

## Stack

| Layer | Tool |
| --- | --- |
| Frontend | Vite + vanilla JS |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| Storage | Supabase Storage |

## Setup

```bash
cd credlock-desk
npm install
cp .env.example .env
# Edit .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Migrations (run in order in Supabase SQL Editor)

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_seed_kavro.sql`
3. `supabase/migrations/003_enterprise_support.sql`
4. `supabase/migrations/004_officer_dept_features.sql`
5. `supabase/migrations/005_full_support_modules.sql`

## Modules

- Officer management (search, filters, CSV export, workload metrics)
- Ticket & request management (statuses, categories, ownership, history)
- Priority & SLA (P1 5m / P2 10m / P3 30m / P4 2h)
- Incident management + notes timeline
- Device & technical operations (KAVRO/MDM, FDX, BNPL, Enrollment)
- Document center
- Management report generator (print/PDF)
- KPI dashboard

## Pull latest on your machine

```bash
cd C:\\Users\\April\\Desktop\\credlock-desk
git pull origin main
npm install
```
