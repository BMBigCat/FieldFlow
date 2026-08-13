import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import type { UpdateCustomerRequest } from "@fieldflow/shared-types";

export class UpdateCustomerDto implements UpdateCustomerRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

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
