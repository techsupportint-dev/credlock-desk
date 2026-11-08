-- CredLock Support Desk – initial schema
-- Run this in Supabase SQL Editor (or via supabase db push)

-- Team / roles
create table if not exists public.team (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  role text not null check (role in ('Admin', 'Officer', 'Viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Tickets
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text unique not null,
  title text not null,
  category text,
  priority text not null default 'Medium',
  status text not null default 'OPEN',
  source text,
  officer text,
  customer text,
  customer_phone text,
  device_imei text,
  description text,
  escalation text default 'None',
  reopen_count int default 0,
  customer_notified boolean default false,
  first_response_at timestamptz,
  resolved_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activity log
create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete cascade,
  type text not null,
  body text not null,
  created_by text,
  created_at timestamptz not null default now()
);

-- Incidents
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text,
  severity text,
  status text default 'Open',
  created_at timestamptz not null default now()
);

-- Playbooks
create table if not exists public.playbooks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  problem text,
  steps text,
  escalate text,
  created_at timestamptz not null default now()
);

-- Kavro Enrollment issues
create table if not exists public.kavro_enrollment (
  id uuid primary key default gen_random_uuid(),
  date_logged date not null default current_date,
  device_imei text,
  device_model text,
  officer text,
  issue_category text,
  error_notes text,
  action_taken text,
  status text default 'In Progress',
  priority text default 'Medium',
  resolution_date date,
  turnaround_days int,
  additional_notes text,
  created_at timestamptz not null default now()
);

-- Kavro Loans
create table if not exists public.kavro_loans (
  id uuid primary key default gen_random_uuid(),
  loan_date date,
  first_name text,
  last_name text,
  phone_number text,
  nin text,
  loan_amount numeric,
  outstanding_balance numeric,
  due_balance numeric,
  days_overdue int,
  loan_status text,
  recovery_officer text,
  merchant_name text,
  device_brand text,
  device_model text,
  device_imei text,
  state text,
  city text,
  last_connected_days int,
  created_at timestamptz not null default now()
);

create index if not exists kavro_loans_phone_idx on public.kavro_loans (phone_number);
create index if not exists kavro_loans_loan_date_idx on public.kavro_loans (loan_date);
create index if not exists kavro_loans_nin_idx on public.kavro_loans (nin);

-- Reports metadata
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  title text,
  period text,
  uploaded_by text,
  storage_path text,
  created_at timestamptz not null default now()
);

-- Config
create table if not exists public.config (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.team enable row level security;
alter table public.tickets enable row level security;
alter table public.activity enable row level security;
alter table public.incidents enable row level security;
alter table public.playbooks enable row level security;
alter table public.kavro_enrollment enable row level security;
alter table public.kavro_loans enable row level security;
alter table public.reports enable row level security;
alter table public.config enable row level security;

create policy "auth all team" on public.team for all to authenticated using (true) with check (true);
create policy "auth all tickets" on public.tickets for all to authenticated using (true) with check (true);
create policy "auth all activity" on public.activity for all to authenticated using (true) with check (true);
create policy "auth all incidents" on public.incidents for all to authenticated using (true) with check (true);
create policy "auth all playbooks" on public.playbooks for all to authenticated using (true) with check (true);
create policy "auth all kavro_enrollment" on public.kavro_enrollment for all to authenticated using (true) with check (true);
create policy "auth all kavro_loans" on public.kavro_loans for all to authenticated using (true) with check (true);
create policy "auth all reports" on public.reports for all to authenticated using (true) with check (true);
create policy "auth all config" on public.config for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('reports', 'reports', false)
on conflict do nothing;
