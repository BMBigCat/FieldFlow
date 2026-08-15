-- Phase 6 gap close: the recurring-maintenance background job (now running
-- for real via BullMQ, see apps/api/src/scheduling) auto-creates a job with
-- no office/admin action behind it, so it needs its own notification type
-- distinct from job_assigned/job_changed (those are always triggered by an
-- office member's explicit action on an existing job).
alter type notification_type add value 'maintenance_auto_scheduled';
