import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { ProcessDuePlansResponse, RecurringMaintenancePlan } from "@fieldflow/shared-types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CreateMaintenancePlanDto } from "./dto/create-maintenance-plan.dto";
import { MaintenancePlansService } from "./maintenance-plans.service";

@Controller("maintenance-plans")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "office")
export class MaintenancePlansController {
  constructor(private readonly maintenancePlansService: MaintenancePlansService) {}

  @Get()
  list(@Req() req: Request): Promise<RecurringMaintenancePlan[]> {
    return this.maintenancePlansService.list(req.user!);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateMaintenancePlanDto): Promise<RecurringMaintenancePlan> {
    return this.maintenancePlansService.create(req.user!, dto);
  }

  @Post("process-due")
  processDue(@Req() req: Request): Promise<ProcessDuePlansResponse> {
    return this.maintenancePlansService.processDue(req.user!);
  }
}
