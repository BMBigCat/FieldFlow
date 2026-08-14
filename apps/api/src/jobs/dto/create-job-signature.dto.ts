import { IsDateString, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import type { CreateJobSignatureRequest } from "@fieldflow/shared-types";

/** Fields alongside the multipart `file` field on POST /jobs/:id/signature. */
export class CreateJobSignatureDto implements CreateJobSignatureRequest {
  @IsString()
  @MinLength(1)
  signedByName!: string;

  @IsOptional()
  @IsUUID()
  clientGeneratedId?: string;

  @IsOptional()
  @IsDateString()
  signedAt?: string;
}
