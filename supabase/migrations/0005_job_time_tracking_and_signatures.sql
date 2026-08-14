-- Phase 4 (build plan §6/§7 offline sync + technician mobile app):
-- job_signatures gets the same offline-dedupe key as job_notes/job_photos;
-- job_time_entries is new (decision D1 — a dedicated append-only table
-- rather than reusing jobs.actual_start/actual_end, so multiple assigned
-- technicians can clock in/out independently on the same job); local_version
-- becomes a real, maintained counter (decision D3) instead of a dead column,
-- so /sync/push can detect conflicting concurrent edits.

alter table public.job_signatures add column client_generated_id uuid;
update public.job_signatures set client_generated_id = gen_random_uuid() where client_generated_id is null;
alter table public.job_signatures alter column client_generated_id set not null;
alter table public.job_signatures
  add constraint job_signatures_job_id_client_generated_id_key unique (job_id, client_generated_id);

create table public.job_time_entries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  technician_id uuid not null references public.users (id),
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  client_generated_id uuid not null,
  created_at timestamptz not null default now(),
  unique (job_id, client_generated_id)
);

create index idx_job_time_entries_job_id on public.job_time_entries (job_id);
create index idx_job_time_entries_technician_id on public.job_time_entries (technician_id);

alter table public.job_time_entries enable row level security;

-- Same shape as job_notes: org members (office/admin) or the assigned
-- technician can read/write; a technician only ever writes their own
-- entries (technician_id = auth.uid()), consistent with clock-in/out being
-- a self-reported action.
create policy "org members read job time entries" on public.job_time_entries
  for select using (
    exists (
      select 1 from public.jobs
      where jobs.id = job_time_entries.job_id
        and jobs.org_id = public.current_user_org_id()
        and (
          public.current_user_role() in ('admin', 'office')
          or public.is_technician_assigned_to_job(jobs.id)
        )
    )
  );

create policy "technicians write own job time entries" on public.job_time_entries
  for insert with check (
    technician_id = auth.uid()
    and exists (
      select 1 from public.jobs
      where jobs.id = job_time_entries.job_id
        and jobs.org_id = public.current_user_org_id()
        and public.is_technician_assigned_to_job(jobs.id)
    )
  );

create policy "technicians update own job time entries" on public.job_time_entries
  for update using (technician_id = auth.uid());

-- local_version (jobs.local_version) was defined in 0001_init.sql but never
-- incremented — make it real so /sync/push can compare a client's
-- baseLocalVersion against the server's current value to detect conflicts.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.local_version = old.local_version + 1;
  return new;
end;
$$;
