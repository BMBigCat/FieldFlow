import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import type { CreateCustomerRequest } from "@fieldflow/shared-types";

export class CreateCustomerDto implements CreateCustomerRequest {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  billingAddress?: string;
}
