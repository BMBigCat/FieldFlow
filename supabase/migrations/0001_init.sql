-- FieldFlow initial schema (build plan §4).
-- Row Level Security is enabled and populated with the access model
-- described in §4/§9: office/admin see everything in their org;
-- technicians see only customers/jobs/equipment tied to jobs assigned to
-- them. Treat these policies as a working baseline to be exercised against
-- real auth flows in Phase 1 (§8), not a final security audit.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type user_role as enum ('admin', 'office', 'technician');

create type job_type as enum (
  'scheduled_service',
  'routine_maintenance',
  'new_install',
  'repair'
);

create type job_status as enum (
  'unscheduled',
  'scheduled',
  'in_progress',
  'completed',
  'invoiced',
  'canceled'
);

create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'void');

create type invoice_external_system as enum ('quickbooks', 'xero');

create type invoice_line_item_kind as enum ('labor', 'part', 'fee');

create type notification_type as enum (
  'job_assigned',
  'job_changed',
  'job_canceled',
  'job_reminder',
  'job_completed',
  'tech_running_behind'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_name text,
  logo_url text,
  brand_primary_color text,
  brand_updated_at timestamptz,
  created_at timestamptz not null default now()
);

-- One row per Supabase Auth user (public.users.id = auth.users.id).
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  full_name text not null,
  role user_role not null,
  phone text,
  push_token text,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  billing_address text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.users (id)
);

create table public.service_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text,
  address text not null,
  lat double precision,
  lng double precision
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  service_address_id uuid not null references public.service_addresses (id) on delete cascade,
  type text not null,
  make text,
  model text,
  serial_number text,
  install_date date,
  warranty_expires date,
  filter_size text,
  notes text
);

create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  author_id uuid not null references public.users (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  service_address_id uuid not null references public.service_addresses (id),
  equipment_id uuid references public.equipment (id),
  type job_type not null,
  status job_status not null default 'unscheduled',
  priority text not null default 'normal',
  description text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  local_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  technician_id uuid not null references public.users (id),
  assigned_at timestamptz not null default now(),
  unique (job_id, technician_id)
);

create table public.job_notes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  author_id uuid not null references public.users (id),
  body text not null,
  created_at timestamptz not null default now(),
  client_generated_id uuid not null,
  unique (job_id, client_generated_id)
);

create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  storage_path text not null,
  caption text,
  uploaded_by uuid not null references public.users (id),
  uploaded_at timestamptz not null default now(),
  client_generated_id uuid not null,
  unique (job_id, client_generated_id)
);

create table public.job_signatures (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  storage_path text not null,
  signed_by_name text not null,
  signed_at timestamptz not null default now()
);

create table public.recurring_maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  frequency_months integer not null,
  next_due_date date not null,
  job_template jsonb not null default '{}'::jsonb
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  job_id uuid references public.jobs (id),
  status invoice_status not null default 'draft',
  issued_at timestamptz,
  due_at timestamptz,
  total numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  paid_at timestamptz,
  external_ref text,
  external_system invoice_external_system
);

create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null,
  kind invoice_line_item_kind not null
);

create table public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type notification_type not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.sync_log (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.users (id),
  device_id text not null,
  synced_at timestamptz not null default now(),
  records_pushed integer not null default 0,
  records_pulled integer not null default 0,
  conflicts_resolved integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Indexes (FKs that get filtered on regularly)
-- ---------------------------------------------------------------------------

create index idx_users_org_id on public.users (org_id);
create index idx_customers_org_id on public.customers (org_id);
create index idx_service_addresses_customer_id on public.service_addresses (customer_id);
create index idx_equipment_customer_id on public.equipment (customer_id);
create index idx_customer_notes_customer_id on public.customer_notes (customer_id);
create index idx_jobs_org_id on public.jobs (org_id);
create index idx_jobs_customer_id on public.jobs (customer_id);
create index idx_jobs_status on public.jobs (status);
create index idx_job_assignments_job_id on public.job_assignments (job_id);
create index idx_job_assignments_technician_id on public.job_assignments (technician_id);
create index idx_job_notes_job_id on public.job_notes (job_id);
create index idx_job_photos_job_id on public.job_photos (job_id);
create index idx_invoices_org_id on public.invoices (org_id);
create index idx_invoices_customer_id on public.invoices (customer_id);
create index idx_invoice_line_items_invoice_id on public.invoice_line_items (invoice_id);
create index idx_notifications_log_user_id on public.notifications_log (user_id);
create index idx_sync_log_technician_id on public.sync_log (technician_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger for jobs
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- security definer + fixed search_path so these are safe to call from
-- policies without letting callers redirect what "public.users" resolves to.
-- ---------------------------------------------------------------------------

create function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.users where id = auth.uid();
$$;

create function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create function public.is_technician_assigned_to_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.job_assignments
    where job_id = target_job_id and technician_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.service_addresses enable row level security;
alter table public.equipment enable row level security;
alter table public.customer_notes enable row level security;
alter table public.jobs enable row level security;
alter table public.job_assignments enable row level security;
alter table public.job_notes enable row level security;
alter table public.job_photos enable row level security;
alter table public.job_signatures enable row level security;
alter table public.recurring_maintenance_plans enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.notifications_log enable row level security;
alter table public.sync_log enable row level security;

-- organizations: any member can read their own org (branding etc.);
-- only admins can update it.
create policy "members read own org" on public.organizations
  for select using (id = public.current_user_org_id());

create policy "admins update own org" on public.organizations
  for update using (
    id = public.current_user_org_id() and public.current_user_role() = 'admin'
  );

-- users: members can read other users in their org; admins manage them.
create policy "members read org users" on public.users
  for select using (org_id = public.current_user_org_id());

create policy "admins manage org users" on public.users
  for insert with check (
    org_id = public.current_user_org_id() and public.current_user_role() = 'admin'
  );

create policy "admins update org users" on public.users
  for update using (
    org_id = public.current_user_org_id() and public.current_user_role() = 'admin'
  );

-- customers: office/admin see all in org; technicians only customers tied
-- to a job assigned to them.
create policy "office reads all org customers" on public.customers
  for select using (
    org_id = public.current_user_org_id()
    and public.current_user_role() in ('admin', 'office')
  );

create policy "technicians read assigned customers" on public.customers
  for select using (
    org_id = public.current_user_org_id()
    and public.current_user_role() = 'technician'
    and exists (
      select 1 from public.jobs
      where jobs.customer_id = customers.id
        and public.is_technician_assigned_to_job(jobs.id)
    )
  );

create policy "office writes org customers" on public.customers
  for insert with check (
    org_id = public.current_user_org_id()
    and public.current_user_role() in ('admin', 'office')
  );

create policy "office updates org customers" on public.customers
  for update using (
    org_id = public.current_user_org_id()
    and public.current_user_role() in ('admin', 'office')
  );

-- service_addresses / equipment / customer_notes: scoped through their
-- parent customer, same office-vs-technician split.
create policy "office reads org service addresses" on public.service_addresses
  for select using (
    exists (
      select 1 from public.customers
      where customers.id = service_addresses.customer_id
        and customers.org_id = public.current_user_org_id()
        and public.current_user_role() in ('admin', 'office')
    )
  );

create policy "technicians read assigned service addresses" on public.service_addresses
  for select using (
    exists (
      select 1 from public.jobs
      where jobs.service_address_id = service_addresses.id
        and public.is_technician_assigned_to_job(jobs.id)
    )
  );

create policy "office writes org service addresses" on public.service_addresses
  for all using (
    exists (
      select 1 from public.customers
      where customers.id = service_addresses.customer_id
        and customers.org_id = public.current_user_org_id()
        and public.current_user_role() in ('admin', 'office')
    )
  );

create policy "office reads org equipment" on public.equipment
  for select using (
    exists (
      select 1 from public.customers
      where customers.id = equipment.customer_id
        and customers.org_id = public.current_user_org_id()
        and public.current_user_role() in ('admin', 'office')
    )
  );

create policy "technicians read assigned equipment" on public.equipment
  for select using (
    exists (
      select 1 from public.jobs
      where jobs.equipment_id = equipment.id
        and public.is_technician_assigned_to_job(jobs.id)
    )
  );

create policy "office writes org equipment" on public.equipment
  for all using (
    exists (
      select 1 from public.customers
      where customers.id = equipment.customer_id
        and customers.org_id = public.current_user_org_id()
        and public.current_user_role() in ('admin', 'office')
    )
  );

create policy "office reads org customer notes" on public.customer_notes
  for select using (
    exists (
      select 1 from public.customers
      where customers.id = customer_notes.customer_id
        and customers.org_id = public.current_user_org_id()
        and public.current_user_role() in ('admin', 'office')
    )
  );

create policy "org members write customer notes" on public.customer_notes
  for insert with check (
    exists (
      select 1 from public.customers
      where customers.id = customer_notes.customer_id
        and customers.org_id = public.current_user_org_id()
    )
  );

-- jobs: office/admin see all in org; technicians see only jobs assigned
-- to them (both select and update, so they can update status/notes on
-- their own jobs).
create policy "office reads all org jobs" on public.jobs
  for select using (
    org_id = public.current_user_org_id()
    and public.current_user_role() in ('admin', 'office')
  );

create policy "technicians read assigned jobs" on public.jobs
  for select using (
    org_id = public.current_user_org_id()
    and public.current_user_role() = 'technician'
    and public.is_technician_assigned_to_job(id)
  );

create policy "office writes org jobs" on public.jobs
  for insert with check (
    org_id = public.current_user_org_id()
    and public.current_user_role() in ('admin', 'office')
  );

create policy "office updates org jobs" on public.jobs
  for update using (
    org_id = public.current_user_org_id()
    and public.current_user_role() in ('admin', 'office')
  );

create policy "technicians update assigned jobs" on public.jobs
  for update using (
    org_id = public.current_user_org_id()
    and public.current_user_role() = 'technician'
    and public.is_technician_assigned_to_job(id)
  );

-- job_assignments / job_notes / job_photos / job_signatures: scoped
-- through the parent job.
create policy "org members read job assignments" on public.job_assignments
  for select using (
    exists (
      select 1 from public.jobs
      where jobs.id = job_assignments.job_id
        and jobs.org_id = public.current_user_org_id()
    )
  );

create policy "office manages job assignments" on public.job_assignments
  for all using (
    exists (
      select 1 from public.jobs
      where jobs.id = job_assignments.job_id
        and jobs.org_id = public.current_user_org_id()
        and public.current_user_role() in ('admin', 'office')
    )
  );

create policy "org members read job notes" on public.job_notes
  for select using (
    exists (
      select 1 from public.jobs
      where jobs.id = job_notes.job_id
        and jobs.org_id = public.current_user_org_id()
        and (
          public.current_user_role() in ('admin', 'office')
          or public.is_technician_assigned_to_job(jobs.id)
        )
    )
  );

create policy "org members write job notes" on public.job_notes
  for insert with check (
    exists (
      select 1 from public.jobs
      where jobs.id = job_notes.job_id
        and jobs.org_id = public.current_user_org_id()
        and (
          public.current_user_role() in ('admin', 'office')
          or public.is_technician_assigned_to_job(jobs.id)
        )
    )
  );

create policy "org members read job photos" on public.job_photos
  for select using (
    exists (
      select 1 from public.jobs
      where jobs.id = job_photos.job_id
        and jobs.org_id = public.current_user_org_id()
        and (
          public.current_user_role() in ('admin', 'office')
          or public.is_technician_assigned_to_job(jobs.id)
        )
    )
  );

create policy "org members write job photos" on public.job_photos
  for insert with check (
    exists (
      select 1 from public.jobs
      where jobs.id = job_photos.job_id
        and jobs.org_id = public.current_user_org_id()
        and (
          public.current_user_role() in ('admin', 'office')
          or public.is_technician_assigned_to_job(jobs.id)
        )
    )
  );

create policy "org members read job signatures" on public.job_signatures
  for select using (
    exists (
      select 1 from public.jobs
      where jobs.id = job_signatures.job_id
        and jobs.org_id = public.current_user_org_id()
        and (
          public.current_user_role() in ('admin', 'office')
          or public.is_technician_assigned_to_job(jobs.id)
        )
    )
  );

create policy "org members write job signatures" on public.job_signatures
  for insert with check (
    exists (
      select 1 from public.jobs
      where jobs.id = job_signatures.job_id
        and jobs.org_id = public.current_user_org_id()
        and (
          public.current_user_role() in ('admin', 'office')
          or public.is_technician_assigned_to_job(jobs.id)
        )
    )
  );

-- recurring_maintenance_plans: office/admin only (drives auto-created jobs).
create policy "office manages recurring maintenance plans" on public.recurring_maintenance_plans
  for all using (
    exists (
      select 1 from public.customers
      where customers.id = recurring_maintenance_plans.customer_id
        and customers.org_id = public.current_user_org_id()
        and public.current_user_role() in ('admin', 'office')
    )
  );

-- invoices / invoice_line_items: office/admin only (v1 has no customer
-- portal — see build plan §1 future scope).
create policy "office manages org invoices" on public.invoices
  for all using (
    org_id = public.current_user_org_id()
    and public.current_user_role() in ('admin', 'office')
  );

create policy "office manages invoice line items" on public.invoice_line_items
  for all using (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_line_items.invoice_id
        and invoices.org_id = public.current_user_org_id()
        and public.current_user_role() in ('admin', 'office')
    )
  );

-- notifications_log: users see only their own notifications.
create policy "users read own notifications" on public.notifications_log
  for select using (user_id = auth.uid());

create policy "users update own notifications" on public.notifications_log
  for update using (user_id = auth.uid());

-- sync_log: technicians write/read their own sync history; office/admin
-- can read all for debugging field issues (§6).
create policy "technicians manage own sync log" on public.sync_log
  for all using (technician_id = auth.uid());

create policy "office reads org sync log" on public.sync_log
  for select using (
    exists (
      select 1 from public.users
      where users.id = sync_log.technician_id
        and users.org_id = public.current_user_org_id()
        and public.current_user_role() in ('admin', 'office')
    )
  );
