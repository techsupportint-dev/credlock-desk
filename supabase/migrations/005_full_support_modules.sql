-- CredLock Technical Support – full modules (Officer, Tickets, SLA, Incidents, Device Ops, Documents, Reports, KPI)
-- Run after 004_officer_dept_features.sql

-- ─── Officer profile expansion ───────────────────────────────
alter table public.profiles add column if not exists staff_id text unique;
alter table public.profiles add column if not exists designation text;
alter table public.profiles add column if not exists date_joined date;
alter table public.profiles add column if not exists profile_photo_url text;
alter table public.profiles add column if not exists official_email text;

-- ─── Ticket fields (full register) ───────────────────────────
alter table public.tickets add column if not exists requester_name text;
alter table public.tickets add column if not exists requester_contact text;
alter table public.tickets add column if not exists requester_type text; -- Customer | Merchant | Internal | Partner
alter table public.tickets add column if not exists source_channel text;
alter table public.tickets add column if not exists affected_device_or_service text;
alter table public.tickets add column if not exists business_impact text;
alter table public.tickets add column if not exists next_action text;
alter table public.tickets add column if not exists follow_up_deadline timestamptz;
alter table public.tickets add column if not exists last_update_at timestamptz;
alter table public.tickets add column if not exists resolution_notes text;
-- acknowledged_at, troubleshooting already in 004
alter table public.tickets add column if not exists sla_first_response_target_minutes int;
alter table public.tickets add column if not exists sla_breached boolean default false;
alter table public.tickets add column if not exists sla_breach_at timestamptz;
alter table public.tickets add column if not exists ticket_age_minutes int;
alter table public.tickets add column if not exists priority_code text; -- P1 | P2 | P3 | P4

-- Normalize status / priority catalogs (application still validates)
-- Suggested statuses: New | Assigned | In Progress | Pending | Escalated | Resolved | Closed | Reopened

-- ─── Incident expansion + notes timeline ─────────────────────
alter table public.incidents add column if not exists incident_ref text unique;
alter table public.incidents add column if not exists discovered_at timestamptz default now();
alter table public.incidents add column if not exists reporting_officer_id uuid references public.profiles(id) on delete set null;
alter table public.incidents add column if not exists affected_department_id uuid references public.departments(id) on delete set null;
alter table public.incidents add column if not exists affected_party text;
alter table public.incidents add column if not exists incident_category text;
alter table public.incidents add column if not exists affected_service text;
alter table public.incidents add column if not exists description text;
alter table public.incidents add column if not exists root_cause text;
alter table public.incidents add column if not exists business_impact text;
alter table public.incidents add column if not exists investigation_findings text;
alter table public.incidents add column if not exists troubleshooting_steps text;
alter table public.incidents add column if not exists immediate_actions text;
alter table public.incidents add column if not exists escalation_details text;
alter table public.incidents add column if not exists responsible_department_id uuid references public.departments(id) on delete set null;
alter table public.incidents add column if not exists resolution_details text;
alter table public.incidents add column if not exists preventive_recommendations text;
alter table public.incidents add column if not exists closed_at timestamptz;
alter table public.incidents add column if not exists related_ticket_id uuid references public.tickets(id) on delete set null;

create table if not exists public.incident_notes (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_email text,
  investigation_update text,
  action_taken text,
  findings text,
  pending_dependency text,
  next_action text,
  created_at timestamptz not null default now()
);

-- ─── Device / technical operations registers ─────────────────
create table if not exists public.device_ops (
  id uuid primary key default gen_random_uuid(),
  ops_type text not null, -- KAVRO_MDM | FDX | BNPL | ENROLLMENT
  reference_no text,
  title text,
  status text default 'Open',
  priority text default 'P3',
  officer_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  related_ticket_id uuid references public.tickets(id) on delete set null,
  -- KAVRO / MDM
  device_imei text,
  device_model text,
  enrollment_status text,
  policy_sync_status text,
  lock_unlock_action text,
  manager_app_issue text,
  offline_policy boolean default false,
  reboot_recovery boolean default false,
  replacement boolean default false,
  imei_validation_result text,
  device_removed boolean default false,
  expired_record boolean default false,
  -- FDX
  post_payment_lock_complaint boolean default false,
  manual_removal boolean default false,
  unlock_request boolean default false,
  failed_unlock boolean default false,
  engineering_escalation boolean default false,
  customer_followup text,
  outstanding boolean default false,
  -- BNPL
  original_imei text,
  replacement_imei text,
  merchant_info text,
  customer_reference text,
  approval_status text,
  technical_verification text,
  completion_date date,
  -- Enrollment
  qr_enrollment_failure boolean default false,
  apk_install_issue boolean default false,
  model_compatibility text,
  enrollment_officer_report text,
  resolution_status text,
  notes text,
  evidence_paths text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Documents center expansion ──────────────────────────────
alter table public.documents add column if not exists title text;
alter table public.documents add column if not exists category text;
alter table public.documents add column if not exists reporting_period text;
alter table public.documents add column if not exists department_id uuid references public.departments(id) on delete set null;
alter table public.documents add column if not exists related_ticket_id uuid references public.tickets(id) on delete set null;
alter table public.documents add column if not exists related_incident_id uuid references public.incidents(id) on delete set null;
alter table public.documents add column if not exists version int default 1;
alter table public.documents add column if not exists parent_document_id uuid references public.documents(id) on delete set null;

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version int not null,
  storage_path text not null,
  filename text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─── Generated management reports metadata ───────────────────
create table if not exists public.management_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null, -- daily | weekly | monthly | quarterly | custom | department | officer | incident | executive
  title text not null,
  period_start date,
  period_end date,
  department_id uuid references public.departments(id) on delete set null,
  officer_id uuid references public.profiles(id) on delete set null,
  generated_by uuid references public.profiles(id) on delete set null,
  payload jsonb, -- structured section data for PDF/DOCX/PPTX export
  status text default 'Draft',
  created_at timestamptz not null default now()
);

-- ─── Ticket assignment / status history (audit) ──────────────
create table if not exists public.ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  change_type text not null, -- assignment | status | priority | sla | note | resolution
  old_value text,
  new_value text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ─── Seed / update priorities as P1–P4 ───────────────────────
insert into public.ticket_priorities (name, sla_hours, color, sort_order) values
  ('P1 Critical', 0, '#b3261e', 1),
  ('P2 High', 0, '#b26a00', 2),
  ('P3 Normal', 1, '#0b6e75', 3),
  ('P4 Low', 2, '#5d6b6a', 4)
on conflict (name) do nothing;

-- Map sla response targets in minutes (application uses these)
-- P1: 5 min, P2: 10 min, P3: 30 min, P4: 120 min (2 business hours)

insert into public.ticket_categories (name, description, sort_order) values
  ('Customer Support', 'End-customer support requests', 1),
  ('Merchant Support', 'Merchant-facing support', 2),
  ('Enrollment', 'Enrollment and onboarding', 3),
  ('Device / MDM', 'Device and MDM operations', 4),
  ('KAVRO', 'KAVRO platform issues', 5),
  ('FDX', 'FDX lock/unlock and related', 6),
  ('Application / Platform', 'Application and platform', 7),
  ('Payment / Transaction', 'Payments and transactions', 8),
  ('IMEI Validation', 'IMEI validation cases', 9),
  ('BNPL Device Swap', 'BNPL device swaps', 10),
  ('Device Unlock', 'Device unlock requests', 11),
  ('Account Access', 'Account access issues', 12),
  ('Internal Staff Request', 'Internal staff technical requests', 13),
  ('Incident / Outage', 'Incidents and outages', 14),
  ('Other', 'Other requests', 15)
on conflict (name) do nothing;

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.incident_notes enable row level security;
alter table public.device_ops enable row level security;
alter table public.document_versions enable row level security;
alter table public.management_reports enable row level security;
alter table public.ticket_history enable row level security;

create policy "auth all incident_notes" on public.incident_notes for all to authenticated using (true) with check (true);
create policy "auth all device_ops" on public.device_ops for all to authenticated using (true) with check (true);
create policy "auth all document_versions" on public.document_versions for all to authenticated using (true) with check (true);
create policy "auth all management_reports" on public.management_reports for all to authenticated using (true) with check (true);
create policy "auth all ticket_history" on public.ticket_history for all to authenticated using (true) with check (true);

-- Indexes
create index if not exists tickets_priority_code_idx on public.tickets (priority_code);
create index if not exists tickets_status_idx on public.tickets (status);
create index if not exists tickets_assigned_to_idx on public.tickets (assigned_to);
create index if not exists device_ops_type_idx on public.device_ops (ops_type);
create index if not exists incident_notes_incident_idx on public.incident_notes (incident_id);
create index if not exists ticket_history_ticket_idx on public.ticket_history (ticket_id);
