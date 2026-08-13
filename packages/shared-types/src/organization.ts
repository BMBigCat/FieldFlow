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
}
