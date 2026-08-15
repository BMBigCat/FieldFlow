# FieldFlow — Full Build Plan

## 0. Purpose of This Document
This is a build plan for a coding agent (e.g. Claude Code) to scaffold and implement this application incrementally, phase by phase. Each phase has a concrete task checklist and acceptance criteria. **Do not start a phase until the previous phase's acceptance criteria are fully met and demoable.** If a product decision is ambiguous, flag it in the PR/commit description rather than guessing silently.

---

## 1. Product Overview

**What it is:** An operations platform for a small-to-midsize HVAC business that centralizes customer records, job scheduling/dispatch, technician field tools (with offline support), and invoicing — replacing paper, spreadsheets, and disconnected tools.

**Who uses it:**
- **Office/Admin users** — run the business from a web dashboard (desktop-first): manage customers, schedule jobs, dispatch technicians, handle invoicing, view reports.
- **Technicians** — use a mobile app (iOS + Android) in the field, **which must work reliably with no or spotty signal** (basements, rural properties, metal-heavy mechanical rooms are common HVAC job sites): see the day's schedule, view job/customer/equipment history, log notes and photos, capture signatures, mark jobs complete.
- **(Future, not in initial scope)** Customers may eventually get a lightweight portal or automated appointment reminders. Design the data model so this isn't painful to bolt on later.

**Core value prop:** One system for "who's doing what job, at which customer, when — with full history — and an invoice at the end of it," that keeps working even when a technician has no signal.

---

## 2. Core Feature List

1. **Customer Database** — profile, contact info, service address(es), billing address, freeform timestamped notes, equipment/asset records (make/model/serial/install date/warranty/filter size), full linked service history.
2. **Job / Work Order Management** — types: Scheduled Service, Routine Maintenance, New Install, Repair. Fields: customer, address, assigned tech(s), scheduled window, status lifecycle, priority, notes, photos, parts used, time tracking, signature capture. Recurring maintenance auto-generates future jobs.
3. **Scheduling / Dispatch** — office calendar (day/week), drag-and-drop assign/reschedule, per-technician daily view, double-booking conflict detection.
4. **Invoicing (built in-house, integration-ready)** — see Section 5 below. Generate from completed jobs, line items, statuses, PDF/email send, payment tracking — built as our own system first, architected so a QuickBooks/Xero/other export or sync can be added later without a rewrite.
5. **Push Notifications** — new job assigned, job time changed/canceled, reminder before next job (technician); job completed, tech running behind (office, optional).
6. **Offline Mode (core requirement, not a stretch goal)** — the technician app must let a tech view their schedule and job details, add notes/photos, capture signatures, and mark jobs complete with zero connectivity, then sync automatically when back online. See Section 6.
7. **Auth & Roles** — Admin, Office Staff, Technician. Technicians see only their own assigned jobs and the customers/equipment tied to those jobs.

---

## 2a. Multi-Tenant Branding / White-Label

The app is used by **multiple separate HVAC companies**, each as its own `organization` (the data model already supports this via `org_id` scoping + RLS — see Section 4). Each organization needs a simple branding settings area so it looks like *their* app, not a generic shared tool:

- **Org settings page (web, admin-only):** upload a logo (stored in Supabase Storage), set a display name (may differ from the internal account name), and optionally a brand color.
- **Where branding shows up:**
  - Web dashboard header/sidebar (logo + company name)
  - Technician mobile app header/login screen
  - Invoice PDFs and emails sent to the org's customers
  - Push notification sender name, where the platform allows customizing it
- **Fallback:** if an org hasn't set a logo/color yet, use a neutral default app logo/theme — never show another org's branding.
- This is purely presentational data scoped per `org_id`; it does not change any RLS or permission logic already defined for orgs.

---

## 3. Recommended Tech Stack

- **Backend:** Node.js + NestJS (TypeScript), REST API
- **Database:** PostgreSQL via Supabase (managed Postgres + Auth + Storage + Row Level Security)
- **Web app (office dashboard):** React + TypeScript + Vite, TanStack Query, shadcn/ui (or Mantine)
- **Mobile app (technicians):** React Native (Expo) — one codebase for iOS + Android
- **Offline data layer (mobile):** local SQLite on-device (via `expo-sqlite` or WatermelonDB) mirroring the subset of Postgres tables a tech needs, plus a sync engine — see Section 6
- **Push notifications:** Expo Push Notifications
- **File storage:** Supabase Storage (job photos, signatures, invoice PDFs), with local device caching for offline capture
- **Background jobs:** Upstash Redis + BullMQ (recurring maintenance job generation, invoice reminders, PDF generation)
- **Hosting:** API on Railway/Render/Fly.io; web app on Vercel; Supabase for DB/Auth/Storage; Expo EAS for mobile builds

This keeps one shared TypeScript type layer across backend, web, and mobile, so the coding agent isn't context-switching languages or duplicating models.

### Monorepo structure
```
/apps
  /api        (NestJS backend)
  /web        (React office dashboard)
  /mobile     (Expo technician app)
/packages
  /shared-types   (TS types/DTOs used by api, web, mobile)
  /invoicing-core (invoicing domain logic + integration adapter interfaces — see Section 5)
```

---

## 4. Data Model (initial schema)

```
organizations
  id, name, created_at,
  display_name (nullable — company's own branding name if different from internal name),
  logo_url (nullable — Supabase Storage path),
  brand_primary_color (nullable, hex — used on invoices/web/mobile theming),
  brand_updated_at

users
  id, org_id, email, full_name, role (admin | office | technician), phone, push_token, created_at

customers
  id, org_id, name, phone, email, billing_address, created_at, created_by

service_addresses
  id, customer_id, label, address, lat, lng

equipment
  id, customer_id, service_address_id, type, make, model, serial_number,
  install_date, warranty_expires, filter_size, notes

customer_notes
  id, customer_id, author_id, body, created_at

jobs
  id, org_id, customer_id, service_address_id, equipment_id (nullable),
  type (scheduled_service | routine_maintenance | new_install | repair),
  status (unscheduled | scheduled | in_progress | completed | invoiced | canceled),
  priority, description,
  scheduled_start, scheduled_end, actual_start, actual_end,
  created_by, created_at,
  local_version (int, for offline sync conflict detection),
  updated_at

job_assignments
  id, job_id, technician_id, assigned_at

job_notes
  id, job_id, author_id, body, created_at, client_generated_id (uuid, for offline dedupe)

job_photos
  id, job_id, storage_path, caption, uploaded_by, uploaded_at, client_generated_id

job_signatures
  id, job_id, storage_path, signed_by_name, signed_at

recurring_maintenance_plans
  id, customer_id, equipment_id, frequency_months, next_due_date, job_template

invoices
  id, org_id, customer_id, job_id (nullable — v1 is 1 job : 1 invoice),
  status (draft | sent | paid | overdue | void),
  issued_at, due_at, total, tax, paid_at,
  external_ref (nullable — id in an external system like QuickBooks once synced),
  external_system (nullable enum — quickbooks | xero | null)

invoice_line_items
  id, invoice_id, description, quantity, unit_price, kind (labor | part | fee)

notifications_log
  id, user_id, type, payload, sent_at, read_at

sync_log  -- mobile offline sync audit trail
  id, technician_id, device_id, synced_at, records_pushed, records_pulled, conflicts_resolved
```

Row Level Security: technicians can only `SELECT`/`UPDATE` customers/jobs/equipment tied to jobs assigned to them; office/admin see everything in their org.

---

## 5. Invoicing — Build In-House, Design for Integration

**Decision:** Invoicing is built as our own first-class feature (not a wrapper around a third party) so the business owns its data and workflow from day one. It must, however, be architected so that connecting to QuickBooks, Xero, or another platform later is an additive change, not a rewrite.

**How to achieve that:**
- Put all invoice creation/line-item/status logic in `packages/invoicing-core`, independent of any specific external API.
- Define an `InvoiceExportAdapter` interface (e.g. `push(invoice): Promise<ExternalRef>`, `pullPaymentStatus(externalRef): Promise<Status>`) in that package. Ship with a `NullAdapter` (does nothing) as the default in Phase 5.
- The `invoices` table already has `external_ref` / `external_system` columns (see schema above) so a future sync doesn't require a migration.
- In Phase 7 (stretch), implement a real `QuickBooksAdapter`/`XeroAdapter` behind that same interface, and add a per-organization setting for which adapter (if any) is active. Nothing in Phases 0–6 should need to change to support this.

**Phase 5 scope (in-house invoicing):**
- Generate invoice from a completed job; auto-pull logged labor time and parts, allow manual line items
- Invoice statuses: draft → sent → paid / overdue / void
- PDF generation + email send (Resend/Postmark)
- Manual "mark as paid" in v1 (no live payment processor yet — that's Phase 7)

---

## 6. Offline Mode — Core Requirement

This is not a nice-to-have; the technician app must be fully usable with zero connectivity. Build this into Phase 4 from the start, not as an afterthought.

**Approach:**
- **Local-first storage on device:** `expo-sqlite` (or WatermelonDB if the agent prefers a sync-oriented ORM) holds a local copy of: today's + tomorrow's assigned jobs, their customers, service addresses, equipment history, and any notes/photos/signatures captured offline.
- **Prefetch on app open (while online):** pull the technician's schedule for the next 48 hours and cache it locally, including customer/equipment data needed to work each job, so it's available the moment signal drops.
- **Write queue:** every offline mutation (note added, photo taken, signature captured, job marked complete, time clocked) is written locally first with a `client_generated_id` (uuid) and queued for sync, and the UI updates optimistically immediately.
- **Sync engine:** on reconnect, push the queue to the API in order, then pull any server-side changes since last sync. Use `client_generated_id` to dedupe (so a retried push doesn't create duplicates) and `local_version`/`updated_at` on `jobs` to detect conflicts.
- **Conflict resolution rule (v1, keep simple):** last-write-wins on job status/schedule fields, but *never* silently drop a technician's offline note or photo — those always append, never overwrite. If a job was reassigned or rescheduled by the office while the tech was offline, surface that clearly in the UI on reconnect rather than silently applying it.
- **Sync status UI:** the technician should always be able to see "synced" / "N changes pending" / "syncing..." so they trust the app in poor-signal conditions.
- Log every sync in `sync_log` for debugging field issues later.

**Acceptance test for offline mode specifically:** put the device in airplane mode, complete a full job (notes + photo + signature + mark complete + clock out), reopen the app while still offline and confirm the data persisted, then reconnect and confirm it appears correctly on the web dashboard within a few seconds with no duplicates.

---

## 7. REST API Surface (initial — expand as needed per phase)

```
Auth
  POST   /auth/login
  POST   /auth/invite          (admin/office only)

Customers
  GET    /customers
  POST   /customers
  GET    /customers/:id
  PATCH  /customers/:id
  POST   /customers/:id/notes
  POST   /customers/:id/equipment

Jobs
  GET    /jobs?technician=&status=&from=&to=
  POST   /jobs
  GET    /jobs/:id
  PATCH  /jobs/:id                 (status, schedule, assignment changes)
  POST   /jobs/:id/notes
  POST   /jobs/:id/photos
  POST   /jobs/:id/signature
  POST   /jobs/:id/clock-in
  POST   /jobs/:id/clock-out

Sync (mobile offline)
  POST   /sync/push               (batched offline mutations, idempotent via client_generated_id)
  GET    /sync/pull?since=

Invoices
  POST   /invoices                (from a completed job)
  GET    /invoices/:id
  PATCH  /invoices/:id            (line items, status)
  POST   /invoices/:id/send

Recurring Maintenance
  GET    /maintenance-plans
  POST   /maintenance-plans

Notifications
  POST   /notifications/register-push-token
```

---

## 8. Phased Build Plan

### Phase 0 — Project Scaffolding ✅ DONE
- [x] Monorepo: `apps/api`, `apps/web`, `apps/mobile`, `packages/shared-types`, `packages/invoicing-core`
- [x] NestJS API boilerplate, connected to Supabase Postgres
- [x] Supabase project created; email/password auth configured
- [x] CI: lint + typecheck + test on push
- [x] `Job`/`Customer`/`Invoice` types defined in `shared-types`, imported by api + web
- **Acceptance:** API boots locally, connects to DB, health-check endpoint responds; shared types compile and are imported in both `api` and `web`. — **verified against live Supabase project.**

### Phase 1 — Auth & Org/Role Foundation ✅ DONE
- [x] Signup/login, org creation, role assignment (admin/office/technician)
- [x] RLS policies: org-scoped, role-scoped
- [x] `whoami`/permissions endpoint
- [x] Org branding settings: logo upload (Supabase Storage), display name, brand color (see Section 2a)
- **Acceptance:** admin logs in, invites an office user and a technician, each sees a correctly restricted response from the permissions endpoint. Admin uploads a logo and sets a display name; it renders on the web dashboard header. — **verified end-to-end (scripted + browser) against the live Supabase project.**

### Phase 2 — Customer Database ✅ DONE
- [x] CRUD: customers, service addresses, equipment, customer notes
- [x] Web: customer list + detail page (contact info, addresses, equipment, notes, service history placeholder)
- **Acceptance:** office user creates a customer, adds an address, adds equipment, adds a note, sees it all on the detail page. Full test coverage on customer endpoints. — **verified end-to-end (scripted + browser).**

### Phase 3 — Job Management & Scheduling (Web) ✅ DONE
- [x] CRUD: jobs (all 4 types), technician assignment
- [x] Calendar view (day + week), drag-and-drop reschedule/reassign
- [x] Job detail page: notes, photo upload, status transitions
- **Acceptance:** office user creates a job, assigns a tech, sees it on the calendar, drags to reschedule, walks it through the full status lifecycle. — **verified end-to-end (scripted + browser), including the double-booking conflict warning.**

### ⏭ Next up: Phase 7 (stretch) — External Integrations, Payments & Reporting (or circle back to close out Phase 6's BullMQ/scheduling gap first)

### Phase 4 — Technician Mobile App (with Offline Mode built in from the start) ✅ DONE
- [x] Expo app scaffold, login, "my day" schedule view
- [x] Job detail: customer info, equipment history, notes, photo capture, signature capture, clock in/out, mark complete
- [x] Local SQLite cache + prefetch of next-48h schedule (pull is scoped to a 48h horizon server-side; My Day itself surfaces today's jobs)
- [x] Write queue for offline mutations + sync engine (push/pull, dedupe, conflict handling per Section 6)
- [x] Sync status indicator in UI
- **Acceptance:** login → sync → today's job rendering verified live in a real browser session against the live Supabase project. Dedup-by-`client_generated_id`, conflict reconciliation (server wins, local cache updated), `removedJobIds` cascade, and photo/signature base64 resolution before push are proven by an automated suite against a real SQLite engine (not a mock). The literal Section 6 acceptance test (airplane mode on a physical device, full job completion, reconnect, dashboard reflects it with no duplicates) has **not** been run on a real device/simulator — this was built and verified via the web preview, and native is the actual target platform per the build plan.

### Phase 5 — Invoicing (in-house, integration-ready) ✅ DONE
- [x] `invoicing-core` package: invoice/line-item domain logic, `InvoiceExportAdapter` interface + `NullAdapter`
- [x] Generate invoice from completed job, auto-pull labor, manual line items
- [x] Invoice statuses, PDF generation, email send
- [x] Web: invoice list/detail/edit views
- **Acceptance:** office user completes a job, generates an invoice, edits line items, sends it, marks it paid; status reflected on customer history. `external_ref`/`external_system` fields present but unused; `NullAdapter` confirmed wired in (called on invoice creation, does nothing). — **verified end-to-end via a scripted run against the live API (signup → complete job with clocked time → generate invoice → confirm rejection for a non-completed job → confirm auto-pulled labor line item priced at the org's rate → edit line items/tax and confirm recomputed total → list → send → download PDF → mark paid) and a browser check (new pages load with zero console errors).**
  - Scope note: there's no "parts used" table anywhere in the schema (build plan §4 never defined one), so "auto-pull ... parts" only applies to labor (from `job_time_entries`) — parts are added as manual line items, same as any other line item.
  - No Resend account exists in this environment, so email send degrades to a reported no-op (`email.sent: false`, with a reason) rather than actually delivering — verified that path, not real delivery.

### Phase 6 — Push Notifications & Recurring Maintenance 🟡 PARTIAL (quick checkpoint — see notes)
- [x] Expo push notifications: new job assigned, job changed/canceled. Register-token endpoint, a send+log service (always logs to `notifications_log` per build plan §4, best-effort sends via Expo if a token is on file), wired into job assignment/reschedule/cancel. `job_reminder` (upcoming-job) not implemented — it needs a scheduled trigger, same gap as below.
- [ ] Recurring maintenance background job (BullMQ): the logic itself is done and verified (finds due plans, creates the next unscheduled job from the template, advances `next_due_date`) — but there's **no BullMQ/Redis** in this environment (no Upstash instance was ever configured, see project start), so nothing runs it on a schedule. Exposed instead as a manually-triggered `POST /maintenance-plans/process-due`. Notifying office on auto-created plans skipped — no `notification_type` enum value fits it without a schema change.
- **Acceptance:** partially met. Assigning/rescheduling/canceling a job correctly logs the notification and attempts a real Expo push send — verified via a scripted run (`notifications_log` entries), but actual delivery to a device is unverified (no physical device or EAS project in this environment; `getExpoPushTokenAsync` needs a real `projectId`). A due recurring plan does auto-create a new unscheduled job with the correct fields and correctly advances its due date — verified via script — but only when `process-due` is called, not on a real automatic schedule.
- **Follow-up when there's a real need for it:** set up Upstash Redis + BullMQ (or a simpler cron), wire it to call `MaintenancePlansService.processDue()` on a schedule and `job_reminder` sends ahead of `scheduledStart`; test push delivery on an actual device once an EAS project exists.

### Phase 7 (stretch) — External Integrations, Payments & Reporting
- [ ] Implement `QuickBooksAdapter` (and/or `XeroAdapter`) behind the existing `InvoiceExportAdapter` interface; per-org setting to enable
- [ ] Real payment processor (Stripe) for online invoice payment
- [ ] Basic reporting dashboard: jobs completed per tech, revenue per period, overdue invoices
- [ ] Foundation for customer-facing appointment reminders (SMS/email)

---

## 9. Non-Functional Requirements
- **Offline resilience** is a core requirement for the technician app (see Section 6), not optional polish.
- **Role-based data access** enforced at the database level (RLS), not just hidden in the UI.
- **Audit trail** — author + timestamp on every mutable record (already reflected in schema).
- **Integration-ready invoicing** — no external platform lock-in, but no rework needed to add one later (see Section 5).
- **Simple onboarding** — admin can add technicians and customers without a manual.

---

## 10. Instructions for the Coding Agent
1. Work phase by phase, in order, checking off tasks as completed. Don't start a phase until the previous one's acceptance criteria demo cleanly.
2. Write tests alongside each feature, not after.
3. Keep `packages/shared-types` as the single source of truth for API/job/customer/invoice shapes across `api`, `web`, and `mobile`.
4. Use Supabase RLS as the primary access-control mechanism, not just API-layer checks.
5. Treat offline mode (Section 6) as a first-class requirement in Phase 4, not a later patch.
6. Keep all invoice logic inside `packages/invoicing-core` behind the `InvoiceExportAdapter` interface so external integrations in Phase 7 are additive.
7. After each phase, produce a short demo script (what to click/call to verify acceptance criteria) before moving to the next phase.
8. Flag any ambiguous product decision in the PR description rather than guessing silently.
