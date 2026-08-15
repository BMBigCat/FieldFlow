import type { ISODateString, UUID } from "./common.js";

/** Build plan §2.5 push notification events. */
export type NotificationType =
  | "job_assigned"
  | "job_changed"
  | "job_canceled"
  | "job_reminder"
  | "job_completed"
  | "tech_running_behind"
  | "maintenance_auto_scheduled";

/** Build plan §4 `notifications_log`. */
export interface NotificationLog {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  payload: Record<string, unknown>;
  sentAt: ISODateString;
  readAt: ISODateString | null;
}

/** POST /notifications/register-push-token */
export interface RegisterPushTokenRequest {
  pushToken: string;
}
