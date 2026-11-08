-- Seed the 11 Kavro Device Enrollment issues
-- Run this AFTER 001_initial_schema.sql

insert into public.kavro_enrollment (date_logged, device_imei, device_model, officer, issue_category, error_notes, action_taken, status, priority, resolution_date, turnaround_days, additional_notes) values
('2025-01-10', '356938101234567', 'Tecno Spark 10', 'Support Officer', 'QR Code Error', 'QR code not scanning during enrollment', 'Regenerated QR and re-enrolled', 'Resolved', 'Medium', '2025-01-10', 0, null),
('2025-01-12', '356938101234568', 'Infinix Hot 30', 'Support Officer', 'APK Install Error', 'APK install failed - insufficient storage', 'Cleared cache and retried install', 'Resolved', 'High', '2025-01-13', 1, null),
('2025-01-15', '356938101234569', 'Samsung A14', 'Support Officer', 'Config Error', 'Policy not applying after enrollment', 'Forced policy sync from MDM console', 'In Progress', 'High', null, null, 'Awaiting device online'),
('2025-01-18', '356938101234570', 'Redmi 12', 'Support Officer', 'QR Code Error', 'Invalid QR payload', 'Issued new enrollment profile', 'Resolved', 'Medium', '2025-01-18', 0, null),
('2025-01-20', '356938101234571', 'Tecno Camon 20', 'Support Officer', 'APK Install Error', 'Package parse error', 'Rebuilt APK and pushed', 'Pending Review', 'Critical', null, null, 'Engineering review'),
('2025-01-22', '356938101234572', 'Itel A70', 'Support Officer', 'Config Error', 'Battery optimization blocking agent', 'Whitelisted agent app', 'Resolved', 'Medium', '2025-01-23', 1, null),
('2025-01-25', '356938101234573', 'Nokia G21', 'Support Officer', 'QR Code Error', 'Camera permission denied', 'Guided user to grant camera', 'Resolved', 'Low', '2025-01-25', 0, null),
('2025-01-28', '356938101234574', 'Infinix Note 30', 'Support Officer', 'APK Install Error', 'Unknown sources disabled', 'Enabled install from MDM', 'In Progress', 'High', null, null, null),
('2025-02-01', '356938101234575', 'Samsung A15', 'Support Officer', 'Config Error', 'Wrong organization unit', 'Reassigned OU and resynced', 'Resolved', 'Medium', '2025-02-01', 0, null),
('2025-02-03', '356938101234576', 'Tecno Spark 20', 'Support Officer', 'QR Code Error', 'Expired enrollment token', 'Generated fresh token', 'Resolved', 'Medium', '2025-02-03', 0, null),
('2025-02-05', '356938101234577', 'Redmi Note 13', 'Support Officer', 'APK Install Error', 'Signature mismatch', 'Aligned signing keys', 'Pending Review', 'Critical', null, null, 'Needs engineering')
on conflict do nothing;
