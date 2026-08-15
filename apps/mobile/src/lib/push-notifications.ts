import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { apiFetch } from "./api";

/**
 * Build plan §6/§7 push notifications. Best-effort and non-blocking — no
 * EAS project is linked in this environment (no `extra.eas.projectId` in
 * app config), and there's no physical device/simulator available here
 * either, so this can't be exercised end-to-end. Written to the current
 * SDK 57 API (`getExpoPushTokenAsync` requires an explicit `projectId`) so
 * it's ready once a real EAS project exists — never throws, since a
 * registration failure must never block login.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (!Device.isDevice) return; // simulators/web don't have real push tokens

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) {
      console.warn("No EAS projectId configured — skipping push token registration.");
      return;
    }

    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    await apiFetch("/notifications/register-push-token", {
      method: "POST",
      body: JSON.stringify({ pushToken }),
    });
  } catch (err) {
    console.warn("Push notification registration failed:", err);
  }
}
