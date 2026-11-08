-- CredLock: full CRUD for authenticated users + storage
-- Run in Supabase SQL Editor if create/edit/upload fails with permission errors.

do $$ declare t text; begin
  foreach t in array array[
    'tickets','incidents','playbooks','documents','departments','profiles',
    'recommendations','device_ops','ticket_history','daily_reports',
    'system_activity','activity','kavro_enrollment','management_reports',
    'incident_notes','document_versions','team'
  ] loop
    begin execute format('alter table public.%I enable row level security', t);
    exception when undefined_table then null; end;
  end loop;
end $$;

drop policy if exists "auth all tickets" on public.tickets;
create policy "auth all tickets" on public.tickets for all to authenticated using (true) with check (true);

drop policy if exists "auth all incidents" on public.incidents;
create policy "auth all incidents" on public.incidents for all to authenticated using (true) with check (true);

drop policy if exists "auth all playbooks" on public.playbooks;
create policy "auth all playbooks" on public.playbooks for all to authenticated using (true) with check (true);

drop policy if exists "auth all documents" on public.documents;
create policy "auth all documents" on public.documents for all to authenticated using (true) with check (true);

drop policy if exists "auth all departments" on public.departments;
create policy "auth all departments" on public.departments for all to authenticated using (true) with check (true);

drop policy if exists "auth all recommendations" on public.recommendations;
create policy "auth all recommendations" on public.recommendations for all to authenticated using (true) with check (true);

drop policy if exists "auth all device_ops" on public.device_ops;
create policy "auth all device_ops" on public.device_ops for all to authenticated using (true) with check (true);

drop policy if exists "auth all ticket_history" on public.ticket_history;
create policy "auth all ticket_history" on public.ticket_history for all to authenticated using (true) with check (true);

do $$ begin
  execute 'create policy "auth all daily_reports" on public.daily_reports for all to authenticated using (true) with check (true)';
exception when others then null; end $$;

drop policy if exists "auth all profiles" on public.profiles;
create policy "auth all profiles" on public.profiles for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do update set public = true;

drop policy if exists "auth upload attachments" on storage.objects;
drop policy if exists "auth read attachments" on storage.objects;
drop policy if exists "public read attachments" on storage.objects;
drop policy if exists "auth update attachments" on storage.objects;
drop policy if exists "auth delete attachments" on storage.objects;

create policy "auth upload attachments" on storage.objects for insert to authenticated with check (bucket_id = 'attachments');
create policy "auth update attachments" on storage.objects for update to authenticated using (bucket_id = 'attachments');
create policy "auth delete attachments" on storage.objects for delete to authenticated using (bucket_id = 'attachments');
create policy "auth read attachments" on storage.objects for select to authenticated using (bucket_id = 'attachments');
create policy "public read attachments" on storage.objects for select to public using (bucket_id = 'attachments');
