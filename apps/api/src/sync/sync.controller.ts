import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { SyncPullResponse, SyncPushResponse } from "@fieldflow/shared-types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SyncPullDto } from "./dto/sync-pull.dto";
import { SyncPushDto } from "./dto/sync-push.dto";
import { SyncService } from "./sync.service";

@Controller("sync")
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post("push")
  push(@Req() req: Request, @Body() dto: SyncPushDto): Promise<SyncPushResponse> {
    return this.syncService.push(req.user!, dto);
  }

  @Post("pull")
  pull(@Req() req: Request, @Body() dto: SyncPullDto): Promise<SyncPullResponse> {
    return this.syncService.pull(req.user!, dto);
  }
}
