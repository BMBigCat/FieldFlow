import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { User } from "@fieldflow/shared-types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@Req() req: Request): Promise<User[]> {
    return this.usersService.list(req.user!);
  }
}
