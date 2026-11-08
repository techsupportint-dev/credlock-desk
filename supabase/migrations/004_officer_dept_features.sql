-- CredLock – Technical Support Officer + Department Head + Department Management
-- Run after 003_enterprise_support.sql

-- ─── Ticket acknowledgement, resolution, investigation ───────
alter table public.tickets add column if not exists acknowledged_at timestamptz;
alter table public.tickets add column if not exists acknowledged_by uuid references public.profiles(id) on delete set null;
alter table public.tickets add column if not exists resolution_notes text;
alter table public.tickets add column if not exists troubleshooting_steps text;
alter table public.tickets add column if not exists investigation_summary text;
alter table public.tickets add column if not exists customer_followup text;
alter table public.tickets add column if not exists merchant_followup text;

-- Reuse / extend activity for structured ticket notes
-- type: Internal Note | Investigation | Troubleshooting | Customer Follow-up | Merchant Follow-up | Status Change | Escalation | Resolution

-- ─── Daily activity reports (officers) ───────────────────────
create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null default current_date,
  officer_id uuid not null references public.profiles(id) on delete cascade,
  tickets_handled int default 0,
  tickets_resolved int default 0,
  tickets_escalated int default 0,
  incidents_logged int default 0,
  summary text,
  challenges text,
  next_actions text,
  submitted_at timestamptz not null default now(),
  unique (report_date, officer_id)
);

-- ─── Department activity history (explicit log) ──────────────
create table if not exists public.department_activity (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ─── Expand departments seed to match product requirements ───
insert into public.departments (name, code, description) values
  ('Technical Support', 'TS', 'Core technical support operations'),
  ('Customer Service', 'CSVC', 'Customer-facing support and service'),
  ('Collections', 'COL', 'Collections operations'),
  ('Recovery', 'REC', 'Recovery operations'),
  ('Merchant Relations', 'MR', 'Merchant relationship management'),
  ('Merchant Acquisition', 'MA', 'Merchant acquisition'),
  ('Enrollment', 'ENR', 'Enrollment and onboarding'),
  ('Risk and Compliance', 'RC', 'Risk and compliance'),
  ('Loan Approval', 'LA', 'Loan approval processes'),
  ('Finance', 'FIN', 'Finance department'),
  ('Engineering / IT', 'ENG', 'Engineering and IT'),
  ('Device Operations', 'DO', 'Device, MDM, KAVRO and enrollment'),
  ('Customer Success', 'CS', 'Merchant and customer-facing support'),
  ('Payments & Risk', 'PR', 'Payment and transaction technical issues'),
  ('IT / Internal', 'IT', 'Internal technical support requests')
on conflict (name) do nothing;

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.daily_reports enable row level security;
alter table public.department_activity enable row level security;

create policy "auth read daily_reports" on public.daily_reports for select to authenticated using (true);
create policy "auth write daily_reports" on public.daily_reports for all to authenticated using (true) with check (true);

create policy "auth read department_activity" on public.department_activity for select to authenticated using (true);
create policy "auth insert department_activity" on public.department_activity for insert to authenticated with check (true);

-- Ensure activity table can hold richer note types (no schema change required)
-- Ensure documents entity_type supports ticket evidence
