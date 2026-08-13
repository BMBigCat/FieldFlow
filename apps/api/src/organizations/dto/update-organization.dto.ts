import { IsHexColor, IsOptional, IsString, MaxLength } from "class-validator";
import type { UpdateOrganizationRequest } from "@fieldflow/shared-types";

export class UpdateOrganizationDto implements UpdateOrganizationRequest {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsHexColor()
  brandPrimaryColor?: string;
}
