import { IsDateString, IsOptional, IsUUID } from "class-validator";
import type { ClockInRequest } from "@fieldflow/shared-types";

export class ClockInDto implements ClockInRequest {
  @IsOptional()
  @IsUUID()
  clientGeneratedId?: string;

  @IsOptional()
  @IsDateString()
  clockInAt?: string;
}
