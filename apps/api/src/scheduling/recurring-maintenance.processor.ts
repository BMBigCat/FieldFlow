import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { MaintenancePlansService } from "../maintenance-plans/maintenance-plans.service";
import { RECURRING_MAINTENANCE_QUEUE } from "../queue/queue.module";

@Processor(RECURRING_MAINTENANCE_QUEUE)
export class RecurringMaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(RecurringMaintenanceProcessor.name);

  constructor(private readonly maintenancePlansService: MaintenancePlansService) {
    super();
  }

  async process(): Promise<void> {
    const { createdJobIds } = await this.maintenancePlansService.processDueAllOrgs();
    if (createdJobIds.length > 0) {
      this.logger.log(`Recurring maintenance: auto-created ${createdJobIds.length} job(s)`);
    }
  }
}
