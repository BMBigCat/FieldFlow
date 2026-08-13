import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { Customer, CustomerDetail, CustomerNote, Equipment, ServiceAddress } from "@fieldflow/shared-types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { CreateCustomerNoteDto } from "./dto/create-customer-note.dto";
import { CreateEquipmentDto } from "./dto/create-equipment.dto";
import { CreateServiceAddressDto } from "./dto/create-service-address.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@Controller("customers")
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@Req() req: Request): Promise<Customer[]> {
    return this.customersService.list(req.user!);
  }

  @UseGuards(RolesGuard)
  @Roles("admin", "office")
  @Post()
  create(@Req() req: Request, @Body() dto: CreateCustomerDto): Promise<Customer> {
    return this.customersService.create(req.user!, dto);
  }

  @Get(":id")
  getDetail(@Req() req: Request, @Param("id") id: string): Promise<CustomerDetail> {
    return this.customersService.getDetail(req.user!, id);
  }

  @UseGuards(RolesGuard)
  @Roles("admin", "office")
  @Patch(":id")
  update(@Req() req: Request, @Param("id") id: string, @Body() dto: UpdateCustomerDto): Promise<Customer> {
    return this.customersService.update(req.user!, id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles("admin", "office")
  @Post(":id/addresses")
  addAddress(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: CreateServiceAddressDto,
  ): Promise<ServiceAddress> {
    return this.customersService.addAddress(req.user!, id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles("admin", "office")
  @Post(":id/equipment")
  addEquipment(@Req() req: Request, @Param("id") id: string, @Body() dto: CreateEquipmentDto): Promise<Equipment> {
    return this.customersService.addEquipment(req.user!, id, dto);
  }

  @Post(":id/notes")
  addNote(@Req() req: Request, @Param("id") id: string, @Body() dto: CreateCustomerNoteDto): Promise<CustomerNote> {
    return this.customersService.addNote(req.user!, id, dto);
  }
}
