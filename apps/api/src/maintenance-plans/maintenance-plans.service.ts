import { Injectable, InternalServerErrorException } from "@nestjs/common";
import type { ProcessDuePlansResponse, RecurringMaintenancePlan } from "@fieldflow/shared-types";
import type { RequestUser } from "../auth/request-user";
import { toRecurringMaintenancePlan } from "../common/mappers";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";
import { CreateMaintenancePlanDto } from "./dto/create-maintenance-plan.dto";

function advanceDate(dateStr: string, months: number): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class MaintenancePlansService {
  constructor(private readonly userClientFactory: SupabaseUserClientFactory) {}

  async list(user: RequestUser): Promise<RecurringMaintenancePlan[]> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const { data, error } = await scoped.from("recurring_maintenance_plans").select("*").order("next_due_date");
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data ?? []).map(toRecurringMaintenancePlan);
  }

  async create(user: RequestUser, dto: CreateMaintenancePlanDto): Promise<RecurringMaintenancePlan> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const { data, error } = await scoped
      .from("recurring_maintenance_plans")
      .insert({
        customer_id: dto.customerId,
        equipment_id: dto.equipmentId,
        frequency_months: dto.frequencyMonths,
        next_due_date: dto.nextDueDate,
        job_template: dto.jobTemplate ?? {},
      })
      .select()
      .single();
    if (error || !data) {
      throw new InternalServerErrorException(error?.message ?? "Failed to create maintenance plan");
    }
    return toRecurringMaintenancePlan(data);
  }

  /**
   * Build plan §6.2 background job — no BullMQ/Redis is set up in this
   * environment (no Upstash instance configured), so this is manually
   * triggered here rather than running on a real schedule. The logic itself
   * — find due plans, create the next job, advance next_due_date — is what
   * a real cron/queue handler would call, so wiring one up later is just
   * adding the trigger, not rewriting this.
   */
  async processDue(user: RequestUser): Promise<ProcessDuePlansResponse> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const today = new Date().toISOString().slice(0, 10);

    const { data: duePlans, error: dueError } = await scoped
      .from("recurring_maintenance_plans")
      .select("*, equipment(service_address_id)")
      .lte("next_due_date", today);
    if (dueError) {
      throw new InternalServerErrorException(dueError.message);
    }

    const createdJobIds: string[] = [];
    for (const row of duePlans ?? []) {
      const { equipment, ...planRow } = row as typeof row & { equipment: { service_address_id: string } | null };
      if (!equipment) continue; // equipment was deleted out from under the plan — skip rather than fail the whole batch

      const template = (planRow.job_template ?? {}) as { type?: string; priority?: string; description?: string };
      const { data: job, error: jobError } = await scoped
        .from("jobs")
        .insert({
          org_id: user.orgId,
          customer_id: planRow.customer_id,
          service_address_id: equipment.service_address_id,
          equipment_id: planRow.equipment_id,
          type: template.type ?? "routine_maintenance",
          priority: template.priority ?? "normal",
          description: template.description ?? null,
          status: "unscheduled",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (jobError || !job) {
        throw new InternalServerErrorException(jobError?.message ?? "Failed to create job from maintenance plan");
      }
      createdJobIds.push(job.id);

      const { error: advanceError } = await scoped
        .from("recurring_maintenance_plans")
        .update({ next_due_date: advanceDate(planRow.next_due_date, planRow.frequency_months) })
        .eq("id", planRow.id);
      if (advanceError) {
        throw new InternalServerErrorException(advanceError.message);
      }
    }

    return { createdJobIds };
  }
}
