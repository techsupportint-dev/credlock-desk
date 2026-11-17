-- ====================================================================
-- CredLock Technical Support: Comprehensive TechDB Seed
-- Migration: 008_seed_users_and_records.sql
-- Synced from Google Sheet TechDB (1wG2U2H1NCeHNEwGbxdecJ2EIODTSsDA3xRgMDOZBx5M)
-- Staff, passcodes ('CredLock@2026'), tickets, incidents, device ops,
-- playbooks, and recommendations.
-- ====================================================================

-- 1. Enable pgcrypto for password hashing
create extension if not exists pgcrypto;

-- 2. Seed Staff Accounts into Supabase auth.users
do $$
declare
  pw_hash text := crypt('CredLock@2026', gen_salt('bf', 10));
begin

  -- ST-0001: Joseph Olayemi (Super Admin / Team Lead)
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud
  ) values (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'techsupport.int@gmail.com',
    pw_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Joseph Olayemi","role":"Super Admin"}',
    true,
    'authenticated',
    'authenticated'
  ) on conflict (id) do update set
    encrypted_password = pw_hash,
    email = excluded.email,
    raw_user_meta_data = excluded.raw_user_meta_data;

  -- ST-0001 (Alt Personal Email): Joseph Olayemi
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud
  ) values (
    '11111111-1111-1111-1111-111111111112',
    '00000000-0000-0000-0000-000000000000',
    'josepholayemi34@gmail.com',
    pw_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Joseph Olayemi","role":"Super Admin"}',
    true,
    'authenticated',
    'authenticated'
  ) on conflict (id) do update set
    encrypted_password = pw_hash,
    email = excluded.email;

  -- ST-0002: Ayegba Peter (Officer)
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud
  ) values (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'peter.support@credlock.com',
    pw_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ayegba Peter","role":"Officer"}',
    false,
    'authenticated',
    'authenticated'
  ) on conflict (id) do update set
    encrypted_password = pw_hash,
    email = excluded.email;

  -- ST-0003: Zainab Sheu (Officer)
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud
  ) values (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'zainab.support@credlock.com',
    pw_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Zainab Sheu","role":"Officer"}',
    false,
    'authenticated',
    'authenticated'
  ) on conflict (id) do update set
    encrypted_password = pw_hash,
    email = excluded.email;

  -- ST-0005: OYEWUNMI TOSIN (Officer - IMEI Operations)
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud
  ) values (
    '55555555-5555-5555-5555-555555555555',
    '00000000-0000-0000-0000-000000000000',
    'oyewunmi.tosin@credlock.com',
    pw_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"OYEWUNMI TOSIN","role":"Officer"}',
    false,
    'authenticated',
    'authenticated'
  ) on conflict (id) do update set
    encrypted_password = pw_hash,
    email = excluded.email;

  -- ST-0007: Joel Oluwasogo (Officer)
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud
  ) values (
    '77777777-7777-7777-7777-777777777777',
    '00000000-0000-0000-0000-000000000000',
    'joel.support@credlock.com',
    pw_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Joel Oluwasogo","role":"Officer"}',
    false,
    'authenticated',
    'authenticated'
  ) on conflict (id) do update set
    encrypted_password = pw_hash,
    email = excluded.email;

  -- ST-0006: Samuel Akolawole (Line Manager)
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud
  ) values (
    '66666666-6666-6666-6666-666666666666',
    '00000000-0000-0000-0000-000000000000',
    'idisrupt26@gmail.com',
    pw_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Samuel Akolawole","role":"Team Lead"}',
    false,
    'authenticated',
    'authenticated'
  ) on conflict (id) do update set
    encrypted_password = pw_hash,
    email = excluded.email;

end $$;

-- 3. Upsert into public.profiles
insert into public.profiles (
  id, email, full_name, role, designation, staff_id, phone, account_status
) values
  ('11111111-1111-1111-1111-111111111111', 'techsupport.int@gmail.com', 'Joseph Olayemi', 'Super Admin', 'Team Lead & Admin', 'ST-0001', '09023275180', 'Active'),
  ('11111111-1111-1111-1111-111111111112', 'josepholayemi34@gmail.com', 'Joseph Olayemi', 'Super Admin', 'Team Lead', 'ST-0001-ALT', '09023275180', 'Active'),
  ('22222222-2222-2222-2222-222222222222', 'peter.support@credlock.com', 'Ayegba Peter', 'Officer', 'Technical Support Officer', 'ST-0002', '+234 802 000 0002', 'Active'),
  ('33333333-3333-3333-3333-333333333333', 'zainab.support@credlock.com', 'Zainab Sheu', 'Officer', 'Technical Support Officer', 'ST-0003', '+234 803 000 0003', 'Active'),
  ('55555555-5555-5555-5555-555555555555', 'oyewunmi.tosin@credlock.com', 'OYEWUNMI TOSIN', 'Officer', 'IMEI Operations Specialist', 'ST-0005', '+234 805 000 0005', 'Active'),
  ('77777777-7777-7777-7777-777777777777', 'joel.support@credlock.com', 'Joel Oluwasogo', 'Officer', 'Technical Support Officer', 'ST-0007', '+234 807 000 0007', 'Active'),
  ('66666666-6666-6666-6666-666666666666', 'idisrupt26@gmail.com', 'Samuel Akolawole', 'Team Lead', 'Line Manager', 'ST-0006', '+234 806 000 0006', 'Active')
on conflict (id) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  designation = excluded.designation,
  staff_id = excluded.staff_id,
  phone = excluded.phone,
  account_status = excluded.account_status;

-- 4. Upsert into public.team
insert into public.team (name, email, role, active) values
  ('Joseph Olayemi', 'techsupport.int@gmail.com', 'Admin', true),
  ('Joseph Olayemi', 'josepholayemi34@gmail.com', 'Admin', true),
  ('Ayegba Peter', 'peter.support@credlock.com', 'Officer', true),
  ('Zainab Sheu', 'zainab.support@credlock.com', 'Officer', true),
  ('OYEWUNMI TOSIN', 'oyewunmi.tosin@credlock.com', 'Officer', true),
  ('Joel Oluwasogo', 'joel.support@credlock.com', 'Officer', true),
  ('Samuel Akolawole', 'idisrupt26@gmail.com', 'Admin', true)
on conflict (email) do update set
  name = excluded.name,
  role = excluded.role,
  active = excluded.active;

-- 5. Seed Tickets directly from TechDB "Issue Log"
insert into public.tickets (
  ticket_no, title, category, issue_type, priority, status, officer,
  customer, requester_name, requester_type, source_channel, description, created_at
) values
  ('TKT-0058', 'Continuous Rebooting Phone at Due Date', 'Device Issue', 'Rebooting Phone', 'P1 Critical', 'In Progress', 'Joseph Olayemi', 'Customer Population #203', 'Customer Population #203', 'Customer', 'Internal', 'Devices continuously rebooting around payment due dates; 203 customers affected in monitoring population.', now() - interval '35 minutes'),
  ('TKT-0059', 'Rebooting Phone Resolution - Model OS Patch', 'Device Issue', 'Rebooting Phone', 'P1 Critical', 'Resolved', 'Joel Oluwasogo', 'Batch Reboot Customers', 'Batch Reboot Customers', 'Customer', 'Internal', 'Devices rebooting on payment due date. Resolved after firmware patch push.', now() - interval '2 hours'),
  ('TKT-0056', 'Device Unlock Request after Loan Clearance', 'Device Unlock', 'Device Unlock Request', 'P3 Normal', 'Resolved', 'Joel Oluwasogo', 'Stephen Tersoo Usha', 'Stephen Tersoo Usha', 'Customer', 'Portal', 'Device Unlock Request for Stephen Tersoo Usha after verified loan settlement.', now() - interval '3 hours'),
  ('TKT-0047', 'Device Unlock Request - Post-Payment Verification', 'Device Unlock', 'Device unlock', 'P3 Normal', 'Resolved', 'Joseph Olayemi', 'Sadiq Ibrahim', 'Sadiq Ibrahim', 'Customer', 'Portal', 'Device unlock processed after settlement clearance confirmed.', now() - interval '4 hours'),
  ('TKT-0046', 'Device Unlock Request - Customer Clearance', 'Device Unlock', 'Device Unlock', 'P3 Normal', 'Resolved', 'OYEWUNMI TOSIN', 'Kumawuese Mercy Kpese', 'Kumawuese Mercy Kpese', 'Customer', 'Phone', 'Device unlock for Kumawuese Mercy Kpese.', now() - interval '5 hours'),
  ('TKT-0045', 'App Removal - Loan Completed', 'Unlock / Removal', 'APP REMOVAL', 'P3 Normal', 'Resolved', 'OYEWUNMI TOSIN', 'Alaba Abiodun Micheal', 'Alaba Abiodun Micheal', 'Customer', 'WhatsApp', 'Manager app removal requested after final BNPL installment completed.', now() - interval '6 hours'),
  ('TKT-0003', 'App Removal Request - Monday Shawol', 'Unlock / Removal', 'App Removal Request', 'P3 Normal', 'Resolved', 'Joel Oluwasogo', 'Monday Shawol', 'Monday Shawol', 'Customer', 'Portal', 'Post-loan completion app removal request.', now() - interval '7 hours'),
  ('TKT-0005', 'App Unlocking - Account #33832301644', 'Device Unlock', 'APP UNLOCKING', 'P3 Normal', 'Resolved', 'Ayegba Peter', 'Account 33832301644', 'Account 33832301644', 'Customer', 'Phone', 'App unlocking request processed on MDM server.', now() - interval '8 hours'),
  ('TKT-0009', 'Device Unlock - Alaba Abiodun Micheal', 'Device Unlock', 'device unlock', 'P3 Normal', 'Resolved', 'Zainab Sheu', 'Alaba Abiodun Micheal', 'Alaba Abiodun Micheal', 'Customer', 'WhatsApp', 'Device unlock requested and validated.', now() - interval '9 hours'),
  ('TKT-0011', 'App Removal - Aregbesola Abosede Agnes', 'Unlock / Removal', 'App removal', 'P3 Normal', 'Resolved', 'Zainab Sheu', 'Aregbesola Abosede Agnes', 'Aregbesola Abosede Agnes', 'Customer', 'Phone', 'Manager app removal performed after settlement confirmation.', now() - interval '10 hours'),
  ('TKT-0048', 'Merchant Approval Request - Fabulous Technologies', 'Merchant Support', 'approval', 'P3 Normal', 'Resolved', 'Joseph Olayemi', 'Fabulous Technologies Nig', 'Fabulous Technologies Nig', 'Merchant', 'Email', 'Merchant onboarding verification and MDM enrollment profile approval.', now() - interval '11 hours'),
  ('TKT-0049', 'Merchant Suspension Review - Rew-Value Enterprise', 'Merchant Support', 'Suspention', 'P2 High', 'Resolved', 'Joseph Olayemi', 'Rew-Value Enterprise RVP', 'Rew-Value Enterprise RVP', 'Merchant', 'Internal', 'Compliance suspension investigation and account verification.', now() - interval '12 hours')
on conflict (ticket_no) do nothing;

-- 6. Seed Incidents directly from TechDB "Incidents"
insert into public.incidents (
  title, severity, status, affected_service, reported_by, description, root_cause, resolution_notes
) values
  ('UNAUTHORIZED DEVICE FIRMWARE AND MANAGER APP TAMPERING', 'Critical', 'In Progress', 'Technical Support and Compliance', 'Mr Kenny (Compliance)', 'Customer reported faulty device with active loan and proceeded to flash device firmware, entering Factory Reset Protection (FRP) mode.', 'Customer attempted unauthorized firmware flash while active loan was attached, triggering FRP lockout.', 'Compliance directed customer to pay 50% of outstanding loan amount (₦174,648 across 4 instalments of ₦43,662).'),
  ('SamSung A07 Enrollment Error', 'Low', 'Resolved', 'Technical Support & Engineering', 'Joseph Olayemi', 'Enrollment Failed: IMEI is valid but serial number is not valid on merchant console.', 'Device serial number mismatch on initial sync.', 'Instructed merchant to restart device; enrollment succeeded after restart.'),
  ('Enrollment Failed - Account Not Fully Removed', 'High', 'Resolved', 'Technical Support', 'Joseph Olayemi', 'Enrollment failed due to previous Google account still bound to device.', 'Account not fully removed from device before enrollment initialization.', 'All Google accounts removed from device and restarted. Enrollment successful.'),
  ('Device Validation — Sarah Bawa (Samsung SM-A065F Blank Screen)', 'High', 'Resolved', 'Technical Support; Engineering', 'Engineering', 'Factory error / blank screen on new Samsung SM-A065F; device required validation against existing KAVRO enrollment (IMEI 350584194515457).', 'Hardware blank screen defect requiring warranty swap and KAVRO enrollment re-link.', 'Escalated to Engineering to associate new replacement device correctly with enrollment.'),
  ('Continuous Reboot at Payment Due Dates', 'High', 'In Progress', 'Technical Support; Engineering', 'Support + Engineering', 'Devices reboot around payment due dates; 203 customers in monitoring population (116 expired, 87 active loans).', 'Agent scheduler timer loop conflict during offline due date calculation.', '211 reboot cases identified; 54 resolved in Sept and 9 in Oct; 148 under active monitoring.')
on conflict do nothing;

-- 7. Seed Playbooks directly from TechDB "Knowledge Base"
insert into public.playbooks (title, category, problem, steps, escalate) values
  ('Overview of CredLock Technical Support Operations', 'General Support', 'Support CredLock BNPL operations by resolving technical complaints from customers, merchants and internal departments.', '1. Device troubleshooting.\n2. Enrollment support and IMEI validation.\n3. KAVRO and FDX issue management.\n4. Incident documentation and ticket escalation to Engineering.', 'Escalate to Engineering or Compliance based on incident severity matrix.'),
  ('Device / App Unlock — Recurring Workload & Standard Response', 'Unlock / Removal', 'Device / app unlock requests account for 81% of operations volume (manual removals and unlocks).', '1. Verify settlement receipt in Paystack / Core Banking.\n2. Execute unlock command via Device Operations console.\n3. Verify device state propagation over cellular / WiFi.\n4. Send confirmation SMS to customer.', 'Automate payment / extension unlock and monitor state propagation.'),
  ('Device Lock / Full Lock After Payment Resolution', 'Unlock / Removal', 'Device remains locked after the customer has paid or extended loan terms.', '1. Check payment webhook delivery timestamp.\n2. Check server-to-device policy receipt.\n3. Issue manual override full-lock release.\n4. Request customer to restart device.', 'Escalate to Engineering if device remains locked >15 minutes post-payment.'),
  ('App / X Manager Removal Standard SOP', 'Unlock / Removal', 'Manager / Credlock / X Manager app removal after full loan completion.', '1. Verify zero loan balance in finance portal.\n2. Issue Release Device & Remove Profile command from console.\n3. Prompt customer to complete uninstallation wizard.', 'Escalate to Finance if payment verification is ambiguous.')
on conflict do nothing;

-- 8. Seed Recommendations directly from TechDB "Notes & Recommendations"
insert into public.recommendations (title, body, source, status, priority, due_date) values
  ('FDX Exception Management — Same-Day Manual Responses', 'Handle legacy post-payment locks with same-day manual responses while FDX engine updates are externally managed. Measure: paid-but-locked complaints trend down week over week.', 'Technical Support + Engineering', 'In Progress', 'High', '2026-11-30'),
  ('Confirm FDX Root Cause of Post-Payment Lock Exceptions', 'Confirm FDX root cause of post-payment lock exceptions with Engineering. Establish documented escalation path and telemetry hooks.', 'Technical Support + Engineering', 'Open', 'High', '2026-12-05'),
  ('Enrollment Monitoring by Device Model & APK Fallback', 'Log enrollment issues by device model and track residual APK installer failures so QR/APK regressions on new Samsung and Itel models are caught early.', 'Technical Support', 'Open', 'Medium', '2026-12-15'),
  ('Correct Lobi AI Aging Calculation & Overdue Algorithm', 'Correct Lobi AI aging calculation linked to 16 aging tickets. Run weekly aging reviews and trigger automated escalation at the SLA threshold.', 'Technical Support + Engineering', 'In Progress', 'Critical', '2026-11-20'),
  ('Redistribute Officer Ticket Workloads (85% Concentration)', '85% of ticket volume currently sits with three officers. Review individual allocations, introduce automated round-robin routing, and balance shift schedules.', 'Technical Support Leadership', 'Open', 'High', '2026-11-25'),
  ('KAVRO Manager App Uninstallation Real-Time Alerts', 'Add real-time alerts to the KAVRO engine capturing reason, device details and timestamp, so every uninstallation is detected, explained and traceable.', 'Engineering + Support Review', 'Open', 'Medium', '2026-12-10')
on conflict do nothing;
