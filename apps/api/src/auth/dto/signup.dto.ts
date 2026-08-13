import { IsEmail, IsString, MinLength } from "class-validator";
import type { SignupRequest } from "@fieldflow/shared-types";

export class SignupDto implements SignupRequest {
  @IsString()
  @MinLength(2)
  orgName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  adminPassword!: string;

  @IsString()
  @MinLength(2)
  adminFullName!: string;
}
