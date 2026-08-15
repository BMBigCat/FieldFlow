import { Body, Controller, Get, Header, Param, Patch, Post, Req, StreamableFile, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { InvoiceDetail, InvoiceListItem, SendInvoiceResponse } from "@fieldflow/shared-types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { InvoicesService } from "./invoices.service";

@Controller("invoices")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "office")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  list(@Req() req: Request): Promise<InvoiceListItem[]> {
    return this.invoicesService.list(req.user!);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateInvoiceDto): Promise<InvoiceDetail> {
    return this.invoicesService.create(req.user!, dto);
  }

  @Get(":id")
  getDetail(@Req() req: Request, @Param("id") id: string): Promise<InvoiceDetail> {
    return this.invoicesService.getDetail(req.user!, id);
  }

  @Patch(":id")
  update(@Req() req: Request, @Param("id") id: string, @Body() dto: UpdateInvoiceDto): Promise<InvoiceDetail> {
    return this.invoicesService.update(req.user!, id, dto);
  }

  @Post(":id/send")
  send(@Req() req: Request, @Param("id") id: string): Promise<SendInvoiceResponse> {
    return this.invoicesService.send(req.user!, id);
  }

  @Get(":id/pdf")
  @Header("Content-Type", "application/pdf")
  async getPdf(@Req() req: Request, @Param("id") id: string): Promise<StreamableFile> {
    const pdf = await this.invoicesService.getPdf(req.user!, id);
    return new StreamableFile(pdf);
  }
}
