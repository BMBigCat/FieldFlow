-- Org logo storage (build plan §2a). Public bucket: logos render in the web
-- header, technician app header/login, and invoice PDFs/emails without
-- requiring auth. Writes are restricted to admins of the owning org via the
-- object path convention "{org_id}/...".

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

create policy "public read logos"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "admins upload own org logo"
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and public.current_user_role() = 'admin'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create policy "admins update own org logo"
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and public.current_user_role() = 'admin'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create policy "admins delete own org logo"
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and public.current_user_role() = 'admin'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );
