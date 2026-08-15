import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { ReportsSummaryResponse } from "@fieldflow/shared-types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "office")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("summary")
  getSummary(
    @Req() req: Request,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<ReportsSummaryResponse> {
    return this.reportsService.getSummary(req.user!, { from, to });
  }
}
