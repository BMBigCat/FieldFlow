import { Processor, WorkerHost } from "@nestjs/bullmq";
import { JOB_REMINDERS_QUEUE } from "../queue/queue.module";
import { JobReminderService } from "./job-reminder.service";

@Processor(JOB_REMINDERS_QUEUE)
export class JobReminderProcessor extends WorkerHost {
  constructor(private readonly jobReminderService: JobReminderService) {
    super();
  }

  async process(): Promise<void> {
    await this.jobReminderService.sendDueReminders();
  }
}
