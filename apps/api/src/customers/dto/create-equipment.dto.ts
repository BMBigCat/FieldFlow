import { IsDateString, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import type { CreateEquipmentRequest } from "@fieldflow/shared-types";

export class CreateEquipmentDto implements CreateEquipmentRequest {
  @IsUUID()
  serviceAddressId!: string;

  @IsString()
  @MinLength(1)
  type!: string;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsDateString()
  installDate?: string;

  @IsOptional()
  @IsDateString()
  warrantyExpires?: string;

  @IsOptional()
  @IsString()
  filterSize?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
