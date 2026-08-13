import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import type { Organization } from "@fieldflow/shared-types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get("me")
  getMine(@Req() req: Request): Promise<Organization> {
    return this.organizationsService.getMine(req.user!);
  }

  @UseGuards(RolesGuard)
  @Roles("admin")
  @Patch("me")
  updateMine(@Req() req: Request, @Body() dto: UpdateOrganizationDto): Promise<Organization> {
    return this.organizationsService.updateMine(req.user!, dto);
  }

  @UseGuards(RolesGuard)
  @Roles("admin")
  @Post("me/logo")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  updateLogo(@Req() req: Request, @UploadedFile() file: Express.Multer.File): Promise<Organization> {
    return this.organizationsService.updateLogo(req.user!, file);
  }
}
