# CredLock Technical Support Desk

Vite + vanilla JS + Supabase. Sidebar layout, KPI charts (Chart.js), officer/ticket/SLA/incident modules.

## Setup

```bash
cd credlock-desk
npm install
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Migrations (Supabase SQL Editor, in order)

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_seed_kavro.sql`
3. `supabase/migrations/003_enterprise_support.sql`
4. `supabase/migrations/004_officer_dept_features.sql`
5. `supabase/migrations/005_full_support_modules.sql`

## Features

- App shell: sidebar + top bar
- Dashboard KPI cards + Chart.js (trend, status, category, priority)
- Officers, tickets, SLA P1–P4, incidents, device ops, documents, reports

Never commit `.env`.
