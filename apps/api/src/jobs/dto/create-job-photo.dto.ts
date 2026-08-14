import { IsDateString, IsOptional, IsString, IsUUID } from "class-validator";
import type { CreateJobPhotoRequest } from "@fieldflow/shared-types";

/** Fields alongside the multipart `file` field on POST /jobs/:id/photos. */
export class CreateJobPhotoDto implements CreateJobPhotoRequest {
  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsUUID()
  clientGeneratedId?: string;

  @IsOptional()
  @IsDateString()
  uploadedAt?: string;
}
