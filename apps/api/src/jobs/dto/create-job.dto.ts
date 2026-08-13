import { IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import type { CreateJobRequest, JobPriority, JobType } from "@fieldflow/shared-types";

const JOB_TYPES: JobType[] = ["scheduled_service", "routine_maintenance", "new_install", "repair"];
const JOB_PRIORITIES: JobPriority[] = ["low", "normal", "high", "urgent"];

export class CreateJobDto implements CreateJobRequest {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  serviceAddressId!: string;

  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @IsIn(JOB_TYPES)
  type!: JobType;

  @IsOptional()
  @IsIn(JOB_PRIORITIES)
  priority?: JobPriority;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  technicianIds?: string[];
}
