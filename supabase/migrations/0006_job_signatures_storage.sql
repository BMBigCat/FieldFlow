-- Job signature storage (build plan §2/§6, Phase 4 decision D5). Mirrors
-- 0004_job_photos_storage.sql exactly: public bucket, RLS-gated by the
-- org_id/job_id path prefix rather than a signed-URL scheme, for consistency
-- with the existing job-photos pattern.

insert into storage.buckets (id, name, public)
values ('job-signatures', 'job-signatures', true)
on conflict (id) do nothing;

create policy "org members read job signatures storage"
  on storage.objects for select
  using (
    bucket_id = 'job-signatures'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create policy "org members upload job signatures storage"
  on storage.objects for insert
  with check (
    bucket_id = 'job-signatures'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
    and (
      public.current_user_role() in ('admin', 'office')
      or public.is_technician_assigned_to_job((storage.foldername(name))[2]::uuid)
    )
  );

create policy "admins and office delete job signatures storage"
  on storage.objects for delete
  using (
    bucket_id = 'job-signatures'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
    and public.current_user_role() in ('admin', 'office')
  );
