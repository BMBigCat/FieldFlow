import { IsDateString, IsOptional, IsUUID } from "class-validator";
import type { ClockOutRequest } from "@fieldflow/shared-types";

export class ClockOutDto implements ClockOutRequest {
  @IsOptional()
  @IsUUID()
  clientGeneratedId?: string;

  @IsOptional()
  @IsDateString()
  clockOutAt?: string;
}
