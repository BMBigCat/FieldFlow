import { InjectQueue } from "@nestjs/bullmq";
import { Module, OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";
import { MaintenancePlansModule } from "../maintenance-plans/maintenance-plans.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { JOB_REMINDERS_QUEUE, QueueModule, RECURRING_MAINTENANCE_QUEUE } from "../queue/queue.module";
import { JobReminderProcessor } from "./job-reminder.processor";
import { JobReminderService } from "./job-reminder.service";
import { RecurringMaintenanceProcessor } from "./recurring-maintenance.processor";

const HOUR_MS = 60 * 60 * 1000;
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/** Build plan §6.2/§2.5 — real scheduled triggers (Phase 6 gap close), replacing the manual-only `process-due` endpoint. */
@Module({
  imports: [QueueModule, MaintenancePlansModule, NotificationsModule],
  providers: [JobReminderService, RecurringMaintenanceProcessor, JobReminderProcessor],
})
export class SchedulingModule implements OnModuleInit {
  constructor(
    @InjectQueue(RECURRING_MAINTENANCE_QUEUE) private readonly maintenanceQueue: Queue,
    @InjectQueue(JOB_REMINDERS_QUEUE) private readonly reminderQueue: Queue,
  ) {}

  /** `upsertJobScheduler` is idempotent by key — safe to call on every boot/redeploy without piling up duplicate repeatable jobs. */
  async onModuleInit(): Promise<void> {
    await this.maintenanceQueue.upsertJobScheduler("process-due-maintenance-plans", { every: HOUR_MS });
    await this.reminderQueue.upsertJobScheduler("send-due-job-reminders", { every: FIFTEEN_MIN_MS });
  }
}
