import { IsEmail, IsIn, IsString, MinLength } from "class-validator";
import type { InviteRequest, UserRole } from "@fieldflow/shared-types";

const ROLES: UserRole[] = ["admin", "office", "technician"];

export class InviteDto implements InviteRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsIn(ROLES)
  role!: UserRole;
}
