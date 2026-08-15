import type { ISODateString, UUID } from "./common.js";

/** Build plan §4 `organizations`, §2a branding fields. */
export interface Organization {
  id: UUID;
  name: string;
  createdAt: ISODateString;
  /** Company's own branding name, if different from the internal account name. */
  displayName: string | null;
  /** Supabase Storage path. */
  logoUrl: string | null;
  /** Hex color, e.g. "#1a73e8". */
  brandPrimaryColor: string | null;
  brandUpdatedAt: ISODateString | null;
  /** Build plan §5 — prices the labor line item auto-pulled onto a
   * generated invoice from a job's logged time entries. Null until an
   * admin sets one; invoices generate with a $0 labor line until then. */
  defaultLaborRate: number | null;
}
