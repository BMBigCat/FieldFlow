import { IsUUID } from "class-validator";
import type { CreateInvoiceRequest } from "@fieldflow/shared-types";

export class CreateInvoiceDto implements CreateInvoiceRequest {
  @IsUUID()
  jobId!: string;
}
