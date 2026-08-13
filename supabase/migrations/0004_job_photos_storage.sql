-- Job photo storage (build plan §2/§6). Public bucket, same rationale as
-- 0002's logos bucket: simplicity (plain getPublicUrl, no signed-URL
-- plumbing) and this isn't highly sensitive data. Object path convention
-- "{org_id}/{job_id}/...", matching job_photos' own RLS: admin/office can
-- write any org job's photos, technicians only their assigned job's.

insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', true)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

create policy "org members read job photos storage"
  on storage.objects for select
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create policy "org members upload job photos storage"
  on storage.objects for insert
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
    and (
      public.current_user_role() in ('admin', 'office')
      or public.is_technician_assigned_to_job((storage.foldername(name))[2]::uuid)
    )
  );

create policy "admins and office delete job photos storage"
  on storage.objects for delete
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
    and public.current_user_role() in ('admin', 'office')
  );
