-- Phase 6 (build plan §2/§7 push notifications): notifications_log had only
-- read/update policies (0001_init.sql) — no insert was ever wired up, since
-- nothing wrote to it before now. A notification is triggered by another
-- org member's action (e.g. office assigns a job to a technician), so this
-- follows the same RLS-as-primary-access-control approach as the rest of
-- the schema (build plan §10.4) rather than reaching for the service-role
-- client: any org member can log a notification for another user in the
-- same org.
create policy "org members create notifications" on public.notifications_log
  for insert with check (
    exists (
      select 1 from public.users
      where users.id = notifications_log.user_id
        and users.org_id = public.current_user_org_id()
    )
  );
