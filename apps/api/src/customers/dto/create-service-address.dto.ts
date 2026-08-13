import { IsLatitude, IsLongitude, IsOptional, IsString, MinLength } from "class-validator";
import type { CreateServiceAddressRequest } from "@fieldflow/shared-types";

export class CreateServiceAddressDto implements CreateServiceAddressRequest {
  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  @MinLength(1)
  address!: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;
}
