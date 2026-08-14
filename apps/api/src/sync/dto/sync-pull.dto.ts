import { IsArray, IsOptional, IsString, IsUUID } from "class-validator";
import type { SyncPullRequest } from "@fieldflow/shared-types";

export class SyncPullDto implements SyncPullRequest {
  @IsOptional()
  @IsString()
  since: string | null = null;

  @IsString()
  deviceId!: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  knownJobIds: string[] = [];
}
