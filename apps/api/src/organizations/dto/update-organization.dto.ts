import { IsHexColor, IsNumber, IsOptional, IsString, Min, MaxLength } from "class-validator";
import type { UpdateOrganizationRequest } from "@fieldflow/shared-types";

export class UpdateOrganizationDto implements UpdateOrganizationRequest {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsHexColor()
  brandPrimaryColor?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultLaborRate?: number;
}
