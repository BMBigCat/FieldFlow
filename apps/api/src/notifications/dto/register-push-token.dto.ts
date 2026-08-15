import { IsString, MinLength } from "class-validator";
import type { RegisterPushTokenRequest } from "@fieldflow/shared-types";

export class RegisterPushTokenDto implements RegisterPushTokenRequest {
  @IsString()
  @MinLength(1)
  pushToken!: string;
}
