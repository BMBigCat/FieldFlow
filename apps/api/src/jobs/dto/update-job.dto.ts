import { IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import type { JobPriority, JobStatus, UpdateJobRequest } from "@fieldflow/shared-types";

const JOB_STATUSES: JobStatus[] = [
  "unscheduled",
  "scheduled",
  "in_progress",
  "completed",
  "invoiced",
  "canceled",
];
const JOB_PRIORITIES: JobPriority[] = ["low", "normal", "high", "urgent"];

export class UpdateJobDto implements UpdateJobRequest {
  @IsOptional()
  @IsIn(JOB_STATUSES)
  status?: JobStatus;

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
  @IsDateString()
  actualStart?: string;

  @IsOptional()
  @IsDateString()
  actualEnd?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  technicianIds?: string[];
}
