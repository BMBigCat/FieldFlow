import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RegisterPushTokenDto } from "./dto/register-push-token.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post("register-push-token")
  @HttpCode(204)
  registerPushToken(@Req() req: Request, @Body() dto: RegisterPushTokenDto): Promise<void> {
    return this.notificationsService.registerPushToken(req.user!, dto);
  }
}
