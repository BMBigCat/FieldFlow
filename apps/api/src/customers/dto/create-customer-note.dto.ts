import { IsString, MinLength } from "class-validator";
import type { CreateCustomerNoteRequest } from "@fieldflow/shared-types";

export class CreateCustomerNoteDto implements CreateCustomerNoteRequest {
  @IsString()
  @MinLength(1)
  body!: string;
}
