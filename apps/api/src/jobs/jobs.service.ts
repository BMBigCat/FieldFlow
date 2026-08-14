import { randomUUID } from "crypto";
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import type { Job, JobDetail, JobListItem, JobNote, JobPhoto, JobSignature, JobTimeEntry } from "@fieldflow/shared-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestUser } from "../auth/request-user";
import { idempotentInsert } from "../common/idempotent-insert";
import {
  toJob,
  toJobNote,
  toJobPhoto,
  toJobSignature,
  toJobTimeEntry,
  toServiceAddress,
  toEquipment,
} from "../common/mappers";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";
import { ClockInDto } from "./dto/clock-in.dto";
import { ClockOutDto } from "./dto/clock-out.dto";
import { CreateJobDto } from "./dto/create-job.dto";
import { CreateJobNoteDto } from "./dto/create-job-note.dto";
import { CreateJobPhotoDto } from "./dto/create-job-photo.dto";
import { CreateJobSignatureDto } from "./dto/create-job-signature.dto";
import { UpdateJobDto } from "./dto/update-job.dto";

export interface JobListFilters {
  technician?: string;
  status?: string;
  from?: string;
  to?: string;
}

const ALLOWED_PHOTO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

@Injectable()
export class JobsService {
  constructor(private readonly userClientFactory: SupabaseUserClientFactory) {}

  async list(user: RequestUser, filters: JobListFilters): Promise<JobListItem[]> {
    const scoped = this.userClientFactory.forToken(user.accessToken);

    // Always embed assignments (as a left join) so callers — the calendar
    // in particular — know who's on each job without an N+1 detail fetch.
    // Filtering BY a technician needs an inner join instead, so the .eq()
    // on the embedded column actually restricts which jobs come back.
    let query = filters.technician
      ? scoped
          .from("jobs")
          .select("*, job_assignments!inner(technician_id)")
          .eq("job_assignments.technician_id", filters.technician)
      : scoped.from("jobs").select("*, job_assignments(technician_id)");

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.from) query = query.gte("scheduled_start", filters.from);
    if (filters.to) query = query.lte("scheduled_start", filters.to);

    const { data, error } = await query.order("scheduled_start", { ascending: true });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data ?? []).map((row) => {
      const { job_assignments, ...jobRow } = row;
      return {
        ...toJob(jobRow),
        technicianIds: (job_assignments ?? []).map((a: { technician_id: string }) => a.technician_id),
      };
    });
  }

  async create(user: RequestUser, dto: CreateJobDto): Promise<Job> {
    const scoped = this.userClientFactory.forToken(user.accessToken);

    const { data, error } = await scoped
      .from("jobs")
      .insert({
        org_id: user.orgId,
        customer_id: dto.customerId,
        service_address_id: dto.serviceAddressId,
        equipment_id: dto.equipmentId ?? null,
        type: dto.type,
        priority: dto.priority ?? "normal",
        description: dto.description ?? null,
        scheduled_start: dto.scheduledStart ?? null,
        scheduled_end: dto.scheduledEnd ?? null,
        // A job created with a known schedule is meaningfully "scheduled"
        // already, not just a bare record — otherwise the DB default of
        // "unscheduled" applies.
        status: dto.scheduledStart ? "scheduled" : "unscheduled",
        created_by: user.id,
      })
      .select()
      .single();
    if (error || !data) {
      throw new InternalServerErrorException(error?.message ?? "Failed to create job");
    }

    if (dto.technicianIds && dto.technicianIds.length > 0) {
      const { error: assignError } = await scoped
        .from("job_assignments")
        .insert(dto.technicianIds.map((technicianId) => ({ job_id: data.id, technician_id: technicianId })));
      if (assignError) {
        throw new InternalServerErrorException(assignError.message);
      }
    }

    return toJob(data);
  }

  async getDetail(user: RequestUser, jobId: string): Promise<JobDetail> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const { data, error } = await scoped
      .from("jobs")
      .select(
        "*, customers(id, name), service_addresses(*), equipment(*), job_assignments(technician_id, users(id, full_name)), job_notes(*), job_photos(*), job_signatures(*), job_time_entries(*)",
      )
      .eq("id", jobId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException("Job not found");
    }

    const {
      customers,
      service_addresses,
      equipment,
      job_assignments,
      job_notes,
      job_photos,
      job_signatures,
      job_time_entries,
      ...jobRow
    } = data;
    return {
      ...toJob(jobRow),
      customer: { id: customers.id, name: customers.name },
      serviceAddress: toServiceAddress(service_addresses),
      equipment: equipment ? toEquipment(equipment) : null,
      assignedTechnicians: (job_assignments ?? []).map(
        (assignment: { users: { id: string; full_name: string } }) => ({
          id: assignment.users.id,
          fullName: assignment.users.full_name,
        }),
      ),
      notes: (job_notes ?? []).map(toJobNote),
      photos: (job_photos ?? []).map(toJobPhoto),
      signatures: (job_signatures ?? []).map(toJobSignature),
      timeEntries: (job_time_entries ?? []).map(toJobTimeEntry),
    };
  }

  async update(user: RequestUser, jobId: string, dto: UpdateJobDto): Promise<Job> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    await this.getJobOrThrow(scoped, jobId);

    if (dto.technicianIds !== undefined) {
      const { error: deleteError } = await scoped.from("job_assignments").delete().eq("job_id", jobId);
      if (deleteError) {
        throw new InternalServerErrorException(deleteError.message);
      }
      if (dto.technicianIds.length > 0) {
        const { error: insertError } = await scoped
          .from("job_assignments")
          .insert(dto.technicianIds.map((technicianId) => ({ job_id: jobId, technician_id: technicianId })));
        if (insertError) {
          throw new InternalServerErrorException(insertError.message);
        }
      }
    }

    const patch: Record<string, unknown> = {};
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.priority !== undefined) patch.priority = dto.priority;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.scheduledStart !== undefined) patch.scheduled_start = dto.scheduledStart;
    if (dto.scheduledEnd !== undefined) patch.scheduled_end = dto.scheduledEnd;
    if (dto.actualStart !== undefined) patch.actual_start = dto.actualStart;
    if (dto.actualEnd !== undefined) patch.actual_end = dto.actualEnd;

    if (Object.keys(patch).length === 0) {
      const { data, error } = await scoped.from("jobs").select("*").eq("id", jobId).single();
      if (error || !data) {
        throw new InternalServerErrorException(error?.message ?? "Failed to load job");
      }
      return toJob(data);
    }

    const { data, error } = await scoped.from("jobs").update(patch).eq("id", jobId).select().single();
    if (error || !data) {
      throw new InternalServerErrorException(error?.message ?? "Failed to update job");
    }
    return toJob(data);
  }

  async addNote(user: RequestUser, jobId: string, dto: CreateJobNoteDto): Promise<JobNote> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    await this.getJobOrThrow(scoped, jobId);

    const clientGeneratedId = dto.clientGeneratedId ?? randomUUID();
    const { row } = await idempotentInsert<Parameters<typeof toJobNote>[0]>(
      scoped,
      "job_notes",
      {
        job_id: jobId,
        author_id: user.id,
        body: dto.body,
        client_generated_id: clientGeneratedId,
        ...(dto.createdAt ? { created_at: dto.createdAt } : {}),
      },
      { job_id: jobId, client_generated_id: clientGeneratedId },
    );
    return toJobNote(row);
  }

  async addPhoto(
    user: RequestUser,
    jobId: string,
    file: Express.Multer.File,
    dto?: CreateJobPhotoDto,
  ): Promise<JobPhoto> {
    if (!ALLOWED_PHOTO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Photo must be a PNG, JPEG, or WebP image");
    }

    const scoped = this.userClientFactory.forToken(user.accessToken);
    await this.getJobOrThrow(scoped, jobId);

    const extension = file.originalname.split(".").pop() ?? "jpg";
    const path = `${user.orgId}/${jobId}/photo-${Date.now()}.${extension}`;

    const { error: uploadError } = await scoped.storage.from("job-photos").upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (uploadError) {
      throw new InternalServerErrorException(uploadError.message);
    }

    const { data: publicUrlData } = scoped.storage.from("job-photos").getPublicUrl(path);
    const clientGeneratedId = dto?.clientGeneratedId ?? randomUUID();

    const { row } = await idempotentInsert<Parameters<typeof toJobPhoto>[0]>(
      scoped,
      "job_photos",
      {
        job_id: jobId,
        // Full public URL, not the bare storage path, so the web app can
        // render it directly — same convention as organizations.logo_url.
        storage_path: publicUrlData.publicUrl,
        caption: dto?.caption ?? null,
        uploaded_by: user.id,
        client_generated_id: clientGeneratedId,
        ...(dto?.uploadedAt ? { uploaded_at: dto.uploadedAt } : {}),
      },
      { job_id: jobId, client_generated_id: clientGeneratedId },
    );
    return toJobPhoto(row);
  }

  async addSignature(
    user: RequestUser,
    jobId: string,
    file: Express.Multer.File,
    dto: CreateJobSignatureDto,
  ): Promise<JobSignature> {
    if (!ALLOWED_PHOTO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Signature must be a PNG, JPEG, or WebP image");
    }

    const scoped = this.userClientFactory.forToken(user.accessToken);
    await this.getJobOrThrow(scoped, jobId);

    const extension = file.originalname.split(".").pop() ?? "png";
    const path = `${user.orgId}/${jobId}/signature-${Date.now()}.${extension}`;

    const { error: uploadError } = await scoped.storage.from("job-signatures").upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (uploadError) {
      throw new InternalServerErrorException(uploadError.message);
    }

    const { data: publicUrlData } = scoped.storage.from("job-signatures").getPublicUrl(path);
    const clientGeneratedId = dto.clientGeneratedId ?? randomUUID();

    const { row } = await idempotentInsert<Parameters<typeof toJobSignature>[0]>(
      scoped,
      "job_signatures",
      {
        job_id: jobId,
        storage_path: publicUrlData.publicUrl,
        signed_by_name: dto.signedByName,
        client_generated_id: clientGeneratedId,
        ...(dto.signedAt ? { signed_at: dto.signedAt } : {}),
      },
      { job_id: jobId, client_generated_id: clientGeneratedId },
    );
    return toJobSignature(row);
  }

  /**
   * Creates a new clock session for this technician on this job. Rejects a
   * second concurrent session (a different `clientGeneratedId` with no
   * `clockOutAt`) but treats a retry of the same session as a no-op, so an
   * offline sync replay of the same clock-in never errors.
   */
  async clockIn(user: RequestUser, jobId: string, dto: ClockInDto): Promise<JobTimeEntry> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    await this.getJobOrThrow(scoped, jobId);

    const clientGeneratedId = dto.clientGeneratedId ?? randomUUID();
    const clockInAt = dto.clockInAt ?? new Date().toISOString();

    const { data: openEntries, error: openError } = await scoped
      .from("job_time_entries")
      .select("client_generated_id")
      .eq("job_id", jobId)
      .eq("technician_id", user.id)
      .is("clock_out_at", null);
    if (openError) {
      throw new InternalServerErrorException(openError.message);
    }
    const openOther = (openEntries ?? []).some(
      (entry: { client_generated_id: string }) => entry.client_generated_id !== clientGeneratedId,
    );
    if (openOther) {
      throw new BadRequestException("Already clocked in on this job");
    }

    const { row } = await idempotentInsert<Parameters<typeof toJobTimeEntry>[0]>(
      scoped,
      "job_time_entries",
      {
        job_id: jobId,
        technician_id: user.id,
        clock_in_at: clockInAt,
        client_generated_id: clientGeneratedId,
      },
      { job_id: jobId, client_generated_id: clientGeneratedId },
    );
    return toJobTimeEntry(row);
  }

  /**
   * Closes an open clock session. When `clientGeneratedId` is given (the
   * sync path — same id as the matching clock-in), targets that exact
   * session and is idempotent: already-closed is returned as-is rather than
   * erroring. Without it (a direct/manual call), closes this technician's
   * currently open session on the job, if any.
   */
  async clockOut(user: RequestUser, jobId: string, dto: ClockOutDto): Promise<JobTimeEntry> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    await this.getJobOrThrow(scoped, jobId);

    const clockOutAt = dto.clockOutAt ?? new Date().toISOString();

    let query = scoped.from("job_time_entries").select("*").eq("job_id", jobId).eq("technician_id", user.id);
    query = dto.clientGeneratedId
      ? query.eq("client_generated_id", dto.clientGeneratedId)
      : query.is("clock_out_at", null);

    const { data: existing, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!existing) {
      throw new BadRequestException("Not clocked in on this job");
    }
    if (existing.clock_out_at) {
      return toJobTimeEntry(existing as Parameters<typeof toJobTimeEntry>[0]);
    }

    const { data, error: updateError } = await scoped
      .from("job_time_entries")
      .update({ clock_out_at: clockOutAt })
      .eq("id", existing.id)
      .select()
      .single();
    if (updateError || !data) {
      throw new InternalServerErrorException(updateError?.message ?? "Failed to clock out");
    }
    return toJobTimeEntry(data);
  }

  private async getJobOrThrow(client: SupabaseClient, jobId: string): Promise<void> {
    const { data, error } = await client.from("jobs").select("id").eq("id", jobId).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException("Job not found");
    }
  }
}
