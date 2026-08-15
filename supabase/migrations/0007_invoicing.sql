-- Phase 5 (build plan §5 invoicing): no hourly rate exists anywhere in the
-- schema, but "auto-pull logged labor time" needs one to price the
-- generated line item. Added as an org-level default (nullable — an org
-- that hasn't set one yet gets a $0 labor line the office edits by hand,
-- rather than the request failing) rather than inventing a
-- per-technician/per-job-type rate the build plan never specified.
alter table public.organizations add column default_labor_rate numeric(10, 2);
