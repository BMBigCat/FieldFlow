import type { ISODateString, UUID } from "./common.js";

/** Build plan §4/§6 `sync_log` — mobile offline sync audit trail. */
export interface SyncLog {
  id: UUID;
  technicianId: UUID;
  deviceId: string;
  syncedAt: ISODateString;
  recordsPushed: number;
  recordsPulled: number;
  conflictsResolved: number;
}
