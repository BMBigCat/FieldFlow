import { Type } from "class-transformer";
import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from "class-validator";
import type { InvoiceLineItemInput, InvoiceLineItemKind, InvoiceStatus, UpdateInvoiceRequest } from "@fieldflow/shared-types";

const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "void"];
const LINE_ITEM_KINDS: InvoiceLineItemKind[] = ["labor", "part", "fee"];

export class InvoiceLineItemInputDto implements InvoiceLineItemInput {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsIn(LINE_ITEM_KINDS)
  kind!: InvoiceLineItemKind;
}

export class UpdateInvoiceDto implements UpdateInvoiceRequest {
  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: InvoiceStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemInputDto)
  lineItems?: InvoiceLineItemInputDto[];
}
