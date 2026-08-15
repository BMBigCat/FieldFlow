import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PushService } from "../notifications/push.service";
import { SupabaseAdminService } from "../supabase/supabase-admin.service";

/** Remind a technician roughly an hour before their job starts (build plan §2.5 — no exact lead time specified). */
const REMINDER_LEAD_TIME_MS = 60 * 60 * 1000;

interface DueJobRow {
  id: string;
  scheduled_start: string;
  job_assignments: { technician_id: string }[];
}

@Injectable()
export class JobReminderService {
  private readonly logger = new Logger(JobReminderService.name);

  constructor(
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly pushService: PushService,
  ) {}

  /**
   * Build plan §2.5 job_reminder — run periodically (see
   * job-reminder.processor.ts) rather than triggered by a job mutation,
   * since a reminder fires relative to wall-clock time. No acting user
   * drives a cron tick and jobs span every org, so this uses the
   * service-role client across all orgs at once — same reasoning as
   * MaintenancePlansService.processDueAllOrgs. Re-running this scan every
   * 15 minutes will see the same due job repeatedly until it starts; dedupe
   * is handled per-technician-per-job by checking notifications_log rather
   * than by narrowing the query window to avoid double sends.
   */
  async sendDueReminders(): Promise<void> {
    const client = this.supabaseAdmin.client;
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_LEAD_TIME_MS);

    const { data: dueJobs, error } = await client
      .from("jobs")
      .select("id, scheduled_start, job_assignments(technician_id)")
      .in("status", ["scheduled", "in_progress"])
      .gte("scheduled_start", now.toISOString())
      .lte("scheduled_start", windowEnd.toISOString());
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    for (const job of (dueJobs ?? []) as DueJobRow[]) {
      for (const assignment of job.job_assignments ?? []) {
        await this.remindOnce(client, job.id, assignment.technician_id);
      }
    }
  }

  private async remindOnce(client: SupabaseClient, jobId: string, technicianId: string): Promise<void> {
    const { data: existing, error: existingError } = await client
      .from("notifications_log")
      .select("id")
      .eq("user_id", technicianId)
      .eq("type", "job_reminder")
      .eq("payload->>jobId", jobId)
      .maybeSingle();
    if (existingError) {
      this.logger.warn(
        `Failed to check existing job_reminder for job ${jobId}/technician ${technicianId}: ${existingError.message}`,
      );
      return;
    }
    if (existing) return; // already reminded this technician for this job

    await this.pushService.notify(client, technicianId, "job_reminder", { jobId });
  }
}
