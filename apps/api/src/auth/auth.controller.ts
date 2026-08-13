import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type {
  InviteResponse,
  LoginResponse,
  SignupResponse,
  WhoAmIResponse,
} from "@fieldflow/shared-types";
import { AuthService } from "./auth.service";
import { InviteDto } from "./dto/invite.dto";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  signup(@Body() dto: SignupDto): Promise<SignupResponse> {
    return this.authService.signup(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "office")
  @Post("invite")
  invite(@Req() req: Request, @Body() dto: InviteDto): Promise<InviteResponse> {
    return this.authService.invite(req.user!, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("whoami")
  whoami(@Req() req: Request): Promise<WhoAmIResponse> {
    return this.authService.whoami(req.user!);
  }
}
