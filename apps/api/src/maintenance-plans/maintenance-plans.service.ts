import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProcessDuePlansResponse, RecurringMaintenancePlan } from "@fieldflow/shared-types";
import type { RequestUser } from "../auth/request-user";
import { toRecurringMaintenancePlan } from "../common/mappers";
import { PushService } from "../notifications/push.service";
import { SupabaseAdminService } from "../supabase/supabase-admin.service";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";
import { CreateMaintenancePlanDto } from "./dto/create-maintenance-plan.dto";

function advanceDate(dateStr: string, months: number): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

interface DuePlanRow {
  id: string;
  customer_id: string;
  equipment_id: string;
  frequency_months: number;
  next_due_date: string;
  job_template: Record<string, unknown>;
}

@Injectable()
export class MaintenancePlansService {
  private readonly logger = new Logger(MaintenancePlansService.name);

  constructor(
    private readonly userClientFactory: SupabaseUserClientFactory,
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly pushService: PushService,
  ) {}

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
   * Build plan §6.2 background job, manual-trigger path — kept for ops/
   * debugging (processing just the caller's own org, on demand) alongside
   * the real scheduled path below (`processDueAllOrgs`, run hourly by
   * `apps/api/src/scheduling`).
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

      const job = await this.createJobFromDuePlan(scoped, planRow as DuePlanRow, equipment, user.orgId, user.id);
      createdJobIds.push(job.id);
    }

    return { createdJobIds };
  }

  /**
   * The real scheduled path (build plan §6.2), run hourly by a BullMQ
   * repeatable job — see `apps/api/src/scheduling/recurring-maintenance.processor.ts`.
   * There's no acting user driving a cron tick, and plans span every org, so
   * this uses the service-role client and iterates all due plans across all
   * orgs at once (RLS would otherwise scope to a single caller's org, which
   * is exactly right for `processDue` above but wrong here).
   */
  async processDueAllOrgs(): Promise<ProcessDuePlansResponse> {
    const client = this.supabaseAdmin.client;
    const today = new Date().toISOString().slice(0, 10);

    const { data: duePlans, error: dueError } = await client
      .from("recurring_maintenance_plans")
      .select("*, equipment(service_address_id), customers(org_id)")
      .lte("next_due_date", today);
    if (dueError) {
      throw new InternalServerErrorException(dueError.message);
    }

    const createdJobIds: string[] = [];
    for (const row of duePlans ?? []) {
      const { equipment, customers, ...planRow } = row as typeof row & {
        equipment: { service_address_id: string } | null;
        customers: { org_id: string } | null;
      };
      if (!equipment || !customers) continue; // equipment/customer deleted out from under the plan — skip, don't fail the batch

      const orgId = customers.org_id;
      const { data: actor, error: actorError } = await client
        .from("users")
        .select("id")
        .eq("org_id", orgId)
        .eq("role", "admin")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (actorError) {
        throw new InternalServerErrorException(actorError.message);
      }
      if (!actor) {
        // No admin on file for this org (shouldn't normally happen) — skip
        // rather than fail the whole batch; jobs.created_by is NOT NULL so
        // there's no "system" actor to fall back to.
        this.logger.warn(`No admin user found for org ${orgId}; skipping maintenance plan ${planRow.id}`);
        continue;
      }

      const job = await this.createJobFromDuePlan(client, planRow as DuePlanRow, equipment, orgId, actor.id);
      createdJobIds.push(job.id);

      const { data: officeUsers, error: officeError } = await client
        .from("users")
        .select("id")
        .eq("org_id", orgId)
        .in("role", ["admin", "office"]);
      if (officeError) {
        throw new InternalServerErrorException(officeError.message);
      }
      await Promise.all(
        (officeUsers ?? []).map((u: { id: string }) =>
          this.pushService.notify(client, u.id, "maintenance_auto_scheduled", {
            jobId: job.id,
            maintenancePlanId: planRow.id,
          }),
        ),
      );
    }

    return { createdJobIds };
  }

  private async createJobFromDuePlan(
    client: SupabaseClient,
    planRow: DuePlanRow,
    equipment: { service_address_id: string },
    orgId: string,
    actorId: string,
  ): Promise<{ id: string }> {
    const template = (planRow.job_template ?? {}) as { type?: string; priority?: string; description?: string };
    const { data: job, error: jobError } = await client
      .from("jobs")
      .insert({
        org_id: orgId,
        customer_id: planRow.customer_id,
        service_address_id: equipment.service_address_id,
        equipment_id: planRow.equipment_id,
        type: template.type ?? "routine_maintenance",
        priority: template.priority ?? "normal",
        description: template.description ?? null,
        status: "unscheduled",
        created_by: actorId,
      })
      .select("id")
      .single();
    if (jobError || !job) {
      throw new InternalServerErrorException(jobError?.message ?? "Failed to create job from maintenance plan");
    }

    const { error: advanceError } = await client
      .from("recurring_maintenance_plans")
      .update({ next_due_date: advanceDate(planRow.next_due_date, planRow.frequency_months) })
      .eq("id", planRow.id);
    if (advanceError) {
      throw new InternalServerErrorException(advanceError.message);
    }

    return job;
  }
}
