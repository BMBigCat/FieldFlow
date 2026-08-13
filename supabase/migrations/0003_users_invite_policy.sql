-- Fix: 0001's "admins manage org users" INSERT policy only allowed
-- role = 'admin', but build plan §7 documents POST /auth/invite as
-- "admin/office only". Office users would pass the API-level role guard
-- and then get silently blocked at the database. Widen INSERT to match;
-- leave UPDATE (role changes on existing users) admin-only as before.

drop policy if exists "admins manage org users" on public.users;

create policy "admins and office invite org users" on public.users
  for insert with check (
    org_id = public.current_user_org_id()
    and public.current_user_role() in ('admin', 'office')
  );
