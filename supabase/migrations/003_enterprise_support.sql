-- CredLock Technical Support Platform – enterprise expansion
-- Run after 001_initial_schema.sql and 002_seed_kavro.sql
-- Real persistent schema for tickets, departments, users, audit, documents, recommendations

-- ─── Departments ─────────────────────────────────────────────
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  description text,
  head_user_id uuid,          -- team lead / dept head (filled after profiles exist)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Profiles (extends Supabase auth.users) ──────────────────
-- Role model: Super Admin | Team Lead | Officer | Viewer
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role text not null check (role in ('Super Admin', 'Team Lead', 'Officer', 'Viewer')),
  department_id uuid references public.departments(id) on delete set null,
  phone text,
  account_status text not null default 'Active'
    check (account_status in ('Active', 'Inactive', 'Suspended')),
  status_reason text,
  status_changed_at timestamptz,
  status_changed_by uuid,     -- profile id of admin who changed status
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Back-fill link for department head
alter table public.departments
  drop constraint if exists departments_head_user_id_fkey;
alter table public.departments
  add constraint departments_head_user_id_fkey
  foreign key (head_user_id) references public.profiles(id) on delete set null;

-- ─── Account status audit log ────────────────────────────────
create table if not exists public.account_status_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  old_status text,
  new_status text not null,
  reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

-- ─── Ticket categories & priorities (configurable) ───────────
create table if not exists public.ticket_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true,
  sort_order int default 0
);

create table if not exists public.ticket_priorities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sla_hours int,              -- response / resolution target
  color text,
  sort_order int default 0
);

-- Expand tickets for full support scope
alter table public.tickets add column if not exists department_id uuid references public.departments(id) on delete set null;
alter table public.tickets add column if not exists assigned_to uuid references public.profiles(id) on delete set null;
alter table public.tickets add column if not exists assigned_by uuid references public.profiles(id) on delete set null;
alter table public.tickets add column if not exists assigned_at timestamptz;
alter table public.tickets add column if not exists merchant_name text;
alter table public.tickets add column if not exists issue_type text;  -- Device | MDM | KAVRO | FDX | Enrollment | BNPL | Payment | Internal | Other
alter table public.tickets add column if not exists sla_due_at timestamptz;
alter table public.tickets add column if not exists escalated boolean default false;
alter table public.tickets add column if not exists escalated_at timestamptz;
alter table public.tickets add column if not exists escalated_to uuid references public.profiles(id) on delete set null;
alter table public.tickets add column if not exists tags text[];

-- ─── System activity / audit log ─────────────────────────────
create table if not exists public.system_activity (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  action text not null,       -- ticket.created | user.suspended | report.approved | ...
  entity_type text,           -- ticket | profile | department | document | report
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ─── Documents / evidence ────────────────────────────────────
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  entity_type text,           -- ticket | incident | kavro | report | general
  entity_id uuid,
  uploaded_by uuid references public.profiles(id) on delete set null,
  description text,
  created_at timestamptz not null default now()
);

-- ─── Management recommendations & corrective actions ─────────
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  source text,                -- Team Lead | Management | Audit
  status text not null default 'Open'
    check (status in ('Open', 'In Progress', 'Completed', 'Closed')),
  priority text default 'Medium',
  department_id uuid references public.departments(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid references public.recommendations(id) on delete cascade,
  title text not null,
  status text not null default 'Open'
    check (status in ('Open', 'In Progress', 'Done')),
  owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ─── SLA / KPI config ────────────────────────────────────────
create table if not exists public.sla_config (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  first_response_hours int,
  resolution_hours int,
  applies_to text,            -- priority name or category or 'all'
  active boolean default true
);

create table if not exists public.kpi_targets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_value numeric,
  unit text,                  -- % | hours | count
  period text default 'monthly', -- daily | weekly | monthly
  active boolean default true
);

-- ─── Reporting periods ───────────────────────────────────────
create table if not exists public.report_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  period_type text not null check (period_type in ('daily', 'weekly', 'monthly')),
  start_date date not null,
  end_date date not null,
  status text default 'Open' check (status in ('Open', 'Closed', 'Archived')),
  created_at timestamptz not null default now()
);

-- ─── Seed default categories, priorities, departments, SLA ───
insert into public.ticket_categories (name, description, sort_order) values
  ('Customer Support', 'Customer and merchant support tickets', 1),
  ('Technical Incident', 'Technical incidents and complaints', 2),
  ('Device / MDM', 'Device, MDM, KAVRO and FDX-related issues', 3),
  ('Enrollment / IMEI', 'Enrollment and IMEI verification cases', 4),
  ('BNPL / Device Swap', 'BNPL device swaps and unlock requests', 5),
  ('Payment / Transaction', 'Payment and transaction-related technical issues', 6),
  ('Internal Support', 'Internal technical support requests', 7),
  ('Other', 'Other technical support requests', 8)
on conflict (name) do nothing;

insert into public.ticket_priorities (name, sla_hours, color, sort_order) values
  ('Critical', 4, '#b3261e', 1),
  ('High', 8, '#b26a00', 2),
  ('Medium', 24, '#0b6e75', 3),
  ('Low', 72, '#5d6b6a', 4)
on conflict (name) do nothing;

insert into public.departments (name, code, description) values
  ('Technical Support', 'TS', 'Core technical support operations'),
  ('Device Operations', 'DO', 'Device, MDM, KAVRO and enrollment'),
  ('Customer Success', 'CS', 'Merchant and customer-facing support'),
  ('Payments & Risk', 'PR', 'Payment and transaction technical issues'),
  ('IT / Internal', 'IT', 'Internal technical support requests')
on conflict (name) do nothing;

insert into public.sla_config (name, first_response_hours, resolution_hours, applies_to) values
  ('Critical SLA', 1, 4, 'Critical'),
  ('High SLA', 2, 8, 'High'),
  ('Medium SLA', 4, 24, 'Medium'),
  ('Low SLA', 8, 72, 'Low')
on conflict (name) do nothing;

insert into public.kpi_targets (name, target_value, unit, period) values
  ('First response within SLA', 90, '%', 'monthly'),
  ('Resolution within SLA', 85, '%', 'monthly'),
  ('Average first response (hours)', 2, 'hours', 'monthly'),
  ('Open ticket backlog', 50, 'count', 'weekly')
on conflict do nothing;

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.account_status_log enable row level security;
alter table public.ticket_categories enable row level security;
alter table public.ticket_priorities enable row level security;
alter table public.system_activity enable row level security;
alter table public.documents enable row level security;
alter table public.recommendations enable row level security;
alter table public.corrective_actions enable row level security;
alter table public.sla_config enable row level security;
alter table public.kpi_targets enable row level security;
alter table public.report_periods enable row level security;

-- Authenticated read for operational tables (tighten later with role checks)
create policy "auth read departments" on public.departments for select to authenticated using (true);
create policy "auth write departments" on public.departments for all to authenticated using (true) with check (true);

create policy "auth read profiles" on public.profiles for select to authenticated using (true);
create policy "auth write profiles" on public.profiles for all to authenticated using (true) with check (true);

create policy "auth read status_log" on public.account_status_log for select to authenticated using (true);
create policy "auth insert status_log" on public.account_status_log for insert to authenticated with check (true);

create policy "auth read categories" on public.ticket_categories for select to authenticated using (true);
create policy "auth write categories" on public.ticket_categories for all to authenticated using (true) with check (true);

create policy "auth read priorities" on public.ticket_priorities for select to authenticated using (true);
create policy "auth write priorities" on public.ticket_priorities for all to authenticated using (true) with check (true);

create policy "auth read activity" on public.system_activity for select to authenticated using (true);
create policy "auth insert activity" on public.system_activity for insert to authenticated with check (true);

create policy "auth read documents" on public.documents for select to authenticated using (true);
create policy "auth insert documents" on public.documents for insert to authenticated with check (true);

create policy "auth read recommendations" on public.recommendations for select to authenticated using (true);
create policy "auth write recommendations" on public.recommendations for all to authenticated using (true) with check (true);

create policy "auth read corrective" on public.corrective_actions for select to authenticated using (true);
create policy "auth write corrective" on public.corrective_actions for all to authenticated using (true) with check (true);

create policy "auth read sla" on public.sla_config for select to authenticated using (true);
create policy "auth write sla" on public.sla_config for all to authenticated using (true) with check (true);

create policy "auth read kpi" on public.kpi_targets for select to authenticated using (true);
create policy "auth write kpi" on public.kpi_targets for all to authenticated using (true) with check (true);

create policy "auth read periods" on public.report_periods for select to authenticated using (true);
create policy "auth write periods" on public.report_periods for all to authenticated using (true) with check (true);

-- Keep old team table for backward compatibility; new code prefers profiles
-- Migrate note: after creating a Super Admin in Auth + profiles, set role = 'Super Admin'
