import { Injectable, Logger } from "@nestjs/common";
import { Expo } from "expo-server-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "@fieldflow/shared-types";

const TITLE: Record<NotificationType, string> = {
  job_assigned: "New job assigned",
  job_changed: "Job schedule changed",
  job_canceled: "Job canceled",
  job_reminder: "Upcoming job",
  job_completed: "Job completed",
  tech_running_behind: "Technician running behind",
  maintenance_auto_scheduled: "Recurring maintenance scheduled",
};

const expo = new Expo();

/**
 * Build plan §2/§7 push notifications. Always logs to `notifications_log`
 * first (the audit trail matters even with no token or a failed send —
 * build plan §4), then best-effort sends via Expo if the user has a
 * registered token. Never throws: a notification failing must never fail
 * the job mutation that triggered it.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  async notify(
    scoped: SupabaseClient,
    userId: string,
    type: NotificationType,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    const { error: logError } = await scoped.from("notifications_log").insert({ user_id: userId, type, payload });
    if (logError) {
      this.logger.warn(`Failed to log notification (${type}) for user ${userId}: ${logError.message}`);
    }

    try {
      const { data: userRow, error: userError } = await scoped
        .from("users")
        .select("push_token")
        .eq("id", userId)
        .maybeSingle();
      if (userError || !userRow?.push_token) return;
      if (!Expo.isExpoPushToken(userRow.push_token)) {
        this.logger.warn(`Invalid Expo push token for user ${userId}`);
        return;
      }

      const body = typeof payload.body === "string" ? payload.body : undefined;
      await expo.sendPushNotificationsAsync([
        { to: userRow.push_token, sound: "default", title: TITLE[type], body, data: payload },
      ]);
    } catch (err) {
      this.logger.warn(`Push send failed (${type}) for user ${userId}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
