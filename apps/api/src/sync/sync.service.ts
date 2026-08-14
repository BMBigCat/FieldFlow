import { Injectable, InternalServerErrorException } from "@nestjs/common";
import type {
  Customer,
  Equipment,
  JobListItem,
  JobNote,
  JobPhoto,
  JobSignature,
  JobStatus,
  JobTimeEntry,
  ServiceAddress,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushItem,
  SyncPushItemResult,
  SyncPushJobStatusItem,
  SyncPushRequest,
  SyncPushResponse,
} from "@fieldflow/shared-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestUser } from "../auth/request-user";
import { toCustomer, toEquipment, toJob, toJobNote, toJobPhoto, toJobSignature, toJobTimeEntry, toServiceAddress } from "../common/mappers";
import { JobsService } from "../jobs/jobs.service";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";

/** Build plan §6 — prefetch the technician's next-48h schedule. */
const PREFETCH_WINDOW_HOURS = 48;

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function fileFromBase64(fileBase64: string, mimeType: string): Express.Multer.File {
  return {
    buffer: Buffer.from(fileBase64, "base64"),
    mimetype: mimeType,
    originalname: `upload.${MIME_EXTENSIONS[mimeType] ?? "bin"}`,
  } as Express.Multer.File;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly userClientFactory: SupabaseUserClientFactory,
    private readonly jobsService: JobsService,
  ) {}

  async push(user: RequestUser, dto: SyncPushRequest): Promise<SyncPushResponse> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const results: SyncPushItemResult[] = [];
    let applied = 0;
    let conflicts = 0;

    for (const item of dto.items) {
      try {
        const result = await this.applyItem(user, scoped, item);
        results.push(result);
        if (result.outcome === "applied") applied += 1;
        if (result.outcome === "conflict") conflicts += 1;
      } catch (err) {
        results.push({
          jobId: item.jobId,
          entityType: item.entityType,
          clientGeneratedId: "clientGeneratedId" in item ? item.clientGeneratedId : undefined,
          outcome: "rejected",
          errorMessage: err instanceof Error ? err.message : "Failed to apply item",
        });
      }
    }

    await this.logSync(scoped, user, {
      recordsPushed: applied,
      recordsPulled: 0,
      conflictsResolved: conflicts,
      deviceId: dto.deviceId,
    });

    return { results, serverTime: new Date().toISOString() };
  }

  private async applyItem(user: RequestUser, scoped: SupabaseClient, item: SyncPushItem): Promise<SyncPushItemResult> {
    switch (item.entityType) {
      case "job_note": {
        const existing = await this.findExisting(scoped, "job_notes", item.jobId, item.clientGeneratedId);
        if (existing) {
          return this.result(item, "duplicate_ignored");
        }
        await this.jobsService.addNote(user, item.jobId, {
          body: item.body,
          clientGeneratedId: item.clientGeneratedId,
          createdAt: item.createdAt,
        });
        return this.result(item, "applied");
      }
      case "job_photo": {
        const existing = await this.findExisting(scoped, "job_photos", item.jobId, item.clientGeneratedId);
        if (existing) {
          return this.result(item, "duplicate_ignored");
        }
        const file = fileFromBase64(item.fileBase64, item.mimeType);
        await this.jobsService.addPhoto(user, item.jobId, file, {
          caption: item.caption,
          clientGeneratedId: item.clientGeneratedId,
          uploadedAt: item.capturedAt,
        });
        return this.result(item, "applied");
      }
      case "job_signature": {
        const existing = await this.findExisting(scoped, "job_signatures", item.jobId, item.clientGeneratedId);
        if (existing) {
          return this.result(item, "duplicate_ignored");
        }
        const file = fileFromBase64(item.fileBase64, item.mimeType);
        await this.jobsService.addSignature(user, item.jobId, file, {
          signedByName: item.signedByName,
          clientGeneratedId: item.clientGeneratedId,
          signedAt: item.signedAt,
        });
        return this.result(item, "applied");
      }
      case "job_time_entry": {
        if (item.kind === "clock_in") {
          const existing = await this.findExisting(scoped, "job_time_entries", item.jobId, item.clientGeneratedId);
          if (existing) {
            return this.result(item, "duplicate_ignored");
          }
          await this.jobsService.clockIn(user, item.jobId, { clientGeneratedId: item.clientGeneratedId, clockInAt: item.at });
          return this.result(item, "applied");
        }
        const { data: entry, error } = await scoped
          .from("job_time_entries")
          .select("clock_out_at")
          .eq("job_id", item.jobId)
          .eq("client_generated_id", item.clientGeneratedId)
          .maybeSingle();
        if (error) {
          throw new InternalServerErrorException(error.message);
        }
        if (entry?.clock_out_at) {
          return this.result(item, "duplicate_ignored");
        }
        await this.jobsService.clockOut(user, item.jobId, { clientGeneratedId: item.clientGeneratedId, clockOutAt: item.at });
        return this.result(item, "applied");
      }
      case "job_status":
        return this.applyJobStatus(scoped, item);
      default:
        return {
          jobId: (item as SyncPushItem).jobId,
          entityType: (item as SyncPushItem).entityType,
          outcome: "rejected",
          errorMessage: "Unknown entity type",
        };
    }
  }

  /**
   * Last-write-wins conflict resolution (build plan §6): equal versions (or
   * a client edit that's chronologically newer than the server's last
   * change) apply cleanly; otherwise the server's state wins and the client
   * gets a "conflict" outcome with the server's current snapshot so it can
   * reconcile locally. Reassignment/reschedule surfacing to the technician
   * is handled separately, in pull's `removedJobIds`/`updatedAt` diffing.
   */
  private async applyJobStatus(scoped: SupabaseClient, item: SyncPushJobStatusItem): Promise<SyncPushItemResult> {
    const { data: current, error } = await scoped
      .from("jobs")
      .select("local_version, status, updated_at")
      .eq("id", item.jobId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!current) {
      return { jobId: item.jobId, entityType: "job_status", outcome: "rejected", errorMessage: "Job not found or not accessible" };
    }

    const clientWins =
      current.local_version === item.baseLocalVersion || new Date(item.updatedAt) > new Date(current.updated_at);

    if (clientWins) {
      const patch: Record<string, unknown> = {};
      if (item.status !== undefined) patch.status = item.status;
      if (item.scheduledStart !== undefined) patch.scheduled_start = item.scheduledStart;
      if (item.scheduledEnd !== undefined) patch.scheduled_end = item.scheduledEnd;
      if (Object.keys(patch).length > 0) {
        const { error: updateError } = await scoped.from("jobs").update(patch).eq("id", item.jobId);
        if (updateError) {
          throw new InternalServerErrorException(updateError.message);
        }
      }
      return { jobId: item.jobId, entityType: "job_status", outcome: "applied" };
    }

    return {
      jobId: item.jobId,
      entityType: "job_status",
      outcome: "conflict",
      conflict: {
        serverStatus: current.status as JobStatus,
        serverLocalVersion: current.local_version as number,
        serverUpdatedAt: current.updated_at as string,
      },
    };
  }

  async pull(user: RequestUser, dto: SyncPullRequest): Promise<SyncPullResponse> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const serverTime = new Date().toISOString();
    const horizonEnd = new Date(Date.now() + PREFETCH_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    let jobsQuery = scoped
      .from("jobs")
      .select("*, job_assignments!inner(technician_id)")
      .eq("job_assignments.technician_id", user.id)
      .lte("scheduled_start", horizonEnd);
    if (dto.since) {
      jobsQuery = jobsQuery.gt("updated_at", dto.since);
    }
    const { data: jobRows, error: jobsError } = await jobsQuery;
    if (jobsError) {
      throw new InternalServerErrorException(jobsError.message);
    }

    const jobs: JobListItem[] = (jobRows ?? []).map((row) => {
      const { job_assignments, ...jobRow } = row;
      return {
        ...toJob(jobRow),
        technicianIds: (job_assignments ?? []).map((a: { technician_id: string }) => a.technician_id),
      };
    });

    // Recomputed against the technician's full current assignment (ignoring
    // `since`/the 48h horizon) so a job that fell outside this pull's scope
    // for an innocuous reason (rescheduled further out) isn't mistaken for
    // a removal.
    const { data: assignedRows, error: assignedError } = await scoped
      .from("jobs")
      .select("id, job_assignments!inner(technician_id)")
      .eq("job_assignments.technician_id", user.id);
    if (assignedError) {
      throw new InternalServerErrorException(assignedError.message);
    }
    const currentlyAssignedIds = new Set((assignedRows ?? []).map((r: { id: string }) => r.id));
    const removedJobIds = dto.knownJobIds.filter((id) => !currentlyAssignedIds.has(id));

    let customers: Customer[] = [];
    let serviceAddresses: ServiceAddress[] = [];
    let equipment: Equipment[] = [];
    let jobNotes: JobNote[] = [];
    let jobPhotos: JobPhoto[] = [];
    let jobSignatures: JobSignature[] = [];
    let jobTimeEntries: JobTimeEntry[] = [];

    if (jobs.length > 0) {
      const jobIds = jobs.map((j) => j.id);
      const customerIds = [...new Set(jobs.map((j) => j.customerId))];

      const { data: customerRows } = await scoped.from("customers").select("*").in("id", customerIds);
      customers = (customerRows ?? []).map(toCustomer);

      const { data: addressRows } = await scoped.from("service_addresses").select("*").in("customer_id", customerIds);
      serviceAddresses = (addressRows ?? []).map(toServiceAddress);

      const { data: equipmentRows } = await scoped.from("equipment").select("*").in("customer_id", customerIds);
      equipment = (equipmentRows ?? []).map(toEquipment);

      const { data: noteRows } = await scoped.from("job_notes").select("*").in("job_id", jobIds);
      jobNotes = (noteRows ?? []).map(toJobNote);

      const { data: photoRows } = await scoped.from("job_photos").select("*").in("job_id", jobIds);
      jobPhotos = (photoRows ?? []).map(toJobPhoto);

      const { data: signatureRows } = await scoped.from("job_signatures").select("*").in("job_id", jobIds);
      jobSignatures = (signatureRows ?? []).map(toJobSignature);

      const { data: timeEntryRows } = await scoped.from("job_time_entries").select("*").in("job_id", jobIds);
      jobTimeEntries = (timeEntryRows ?? []).map(toJobTimeEntry);
    }

    await this.logSync(scoped, user, {
      recordsPushed: 0,
      recordsPulled:
        jobs.length +
        customers.length +
        serviceAddresses.length +
        equipment.length +
        jobNotes.length +
        jobPhotos.length +
        jobSignatures.length +
        jobTimeEntries.length,
      conflictsResolved: 0,
      deviceId: dto.deviceId,
    });

    return {
      serverTime,
      jobs,
      customers,
      serviceAddresses,
      equipment,
      jobNotes,
      jobPhotos,
      jobSignatures,
      jobTimeEntries,
      removedJobIds,
    };
  }

  private async findExisting(
    scoped: SupabaseClient,
    table: string,
    jobId: string,
    clientGeneratedId: string,
  ): Promise<{ id: string } | null> {
    const { data, error } = await scoped
      .from(table)
      .select("id")
      .eq("job_id", jobId)
      .eq("client_generated_id", clientGeneratedId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data;
  }

  private result(item: SyncPushItem, outcome: SyncPushItemResult["outcome"]): SyncPushItemResult {
    return {
      jobId: item.jobId,
      entityType: item.entityType,
      clientGeneratedId: "clientGeneratedId" in item ? item.clientGeneratedId : undefined,
      outcome,
    };
  }

  private async logSync(
    scoped: SupabaseClient,
    user: RequestUser,
    info: { recordsPushed: number; recordsPulled: number; conflictsResolved: number; deviceId: string },
  ): Promise<void> {
    const { error } = await scoped.from("sync_log").insert({
      technician_id: user.id,
      device_id: info.deviceId,
      records_pushed: info.recordsPushed,
      records_pulled: info.recordsPulled,
      conflicts_resolved: info.conflictsResolved,
    });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
