import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import type { Job, JobDetail, JobListItem, JobNote, JobPhoto, JobSignature, JobTimeEntry } from "@fieldflow/shared-types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ClockInDto } from "./dto/clock-in.dto";
import { ClockOutDto } from "./dto/clock-out.dto";
import { CreateJobDto } from "./dto/create-job.dto";
import { CreateJobNoteDto } from "./dto/create-job-note.dto";
import { CreateJobPhotoDto } from "./dto/create-job-photo.dto";
import { CreateJobSignatureDto } from "./dto/create-job-signature.dto";
import { UpdateJobDto } from "./dto/update-job.dto";
import { JobsService } from "./jobs.service";

@Controller("jobs")
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query("technician") technician?: string,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<JobListItem[]> {
    return this.jobsService.list(req.user!, { technician, status, from, to });
  }

  @UseGuards(RolesGuard)
  @Roles("admin", "office")
  @Post()
  create(@Req() req: Request, @Body() dto: CreateJobDto): Promise<Job> {
    return this.jobsService.create(req.user!, dto);
  }

  @Get(":id")
  getDetail(@Req() req: Request, @Param("id") id: string): Promise<JobDetail> {
    return this.jobsService.getDetail(req.user!, id);
  }

  @Patch(":id")
  update(@Req() req: Request, @Param("id") id: string, @Body() dto: UpdateJobDto): Promise<Job> {
    return this.jobsService.update(req.user!, id, dto);
  }

  @Post(":id/notes")
  addNote(@Req() req: Request, @Param("id") id: string, @Body() dto: CreateJobNoteDto): Promise<JobNote> {
    return this.jobsService.addNote(req.user!, id, dto);
  }

  @Post(":id/photos")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }))
  addPhoto(
    @Req() req: Request,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateJobPhotoDto,
  ): Promise<JobPhoto> {
    return this.jobsService.addPhoto(req.user!, id, file, dto);
  }

  @Post(":id/signature")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }))
  addSignature(
    @Req() req: Request,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateJobSignatureDto,
  ): Promise<JobSignature> {
    return this.jobsService.addSignature(req.user!, id, file, dto);
  }

  @Post(":id/clock-in")
  clockIn(@Req() req: Request, @Param("id") id: string, @Body() dto: ClockInDto): Promise<JobTimeEntry> {
    return this.jobsService.clockIn(req.user!, id, dto);
  }

  @Post(":id/clock-out")
  clockOut(@Req() req: Request, @Param("id") id: string, @Body() dto: ClockOutDto): Promise<JobTimeEntry> {
    return this.jobsService.clockOut(req.user!, id, dto);
  }
}
