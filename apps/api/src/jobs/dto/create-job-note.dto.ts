import { IsString, MinLength } from "class-validator";
import type { CreateJobNoteRequest } from "@fieldflow/shared-types";

export class CreateJobNoteDto implements CreateJobNoteRequest {
  @IsString()
  @MinLength(1)
  body!: string;
}
