-- Run in Supabase SQL Editor after creating bucket "attachments" in Storage UI
-- (Storage → New bucket → name: attachments → Public optional)

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do update set public = excluded.public;

create policy if not exists "auth upload attachments"
on storage.objects for insert to authenticated
with check (bucket_id = 'attachments');

create policy if not exists "auth read attachments"
on storage.objects for select to authenticated
using (bucket_id = 'attachments');

create policy if not exists "public read attachments"
on storage.objects for select to public
using (bucket_id = 'attachments');
