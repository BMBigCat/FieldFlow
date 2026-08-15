import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import type { CreateMaintenancePlanRequest, Job, JobPriority, JobType } from "@fieldflow/shared-types";

const JOB_TYPES: JobType[] = ["scheduled_service", "routine_maintenance", "new_install", "repair"];
const JOB_PRIORITIES: JobPriority[] = ["low", "normal", "high", "urgent"];

class JobTemplateDto implements Partial<Pick<Job, "type" | "priority" | "description">> {
  @IsOptional()
  @IsIn(JOB_TYPES)
  type?: JobType;

  @IsOptional()
  @IsIn(JOB_PRIORITIES)
  priority?: JobPriority;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateMaintenancePlanDto implements CreateMaintenancePlanRequest {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  equipmentId!: string;

  @IsInt()
  @Min(1)
  frequencyMonths!: number;

  @IsDateString()
  nextDueDate!: string;

  @IsOptional()
  jobTemplate?: JobTemplateDto;
}
