import type { ISODateString, UUID } from "./common.js";

/** Build plan §2/§7 — Admin, Office Staff, Technician. */
export type UserRole = "admin" | "office" | "technician";

/** Build plan §4 `users`. */
export interface User {
  id: UUID;
  orgId: UUID;
  email: string;
  fullName: string;
  role: UserRole;
  phone: string | null;
  /** Expo push token, registered via POST /notifications/register-push-token. */
  pushToken: string | null;
  createdAt: ISODateString;
}
