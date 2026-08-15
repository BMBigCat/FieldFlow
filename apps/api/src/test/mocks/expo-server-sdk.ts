// expo-server-sdk ships ESM that Jest's default (non-transformed) node_modules
// handling can't parse. Test-only stand-in — real send behavior is never
// exercised in unit tests anyway (PushService itself is mocked out wherever
// it'd otherwise fire), this just lets the module graph load.
/* eslint-disable @typescript-eslint/no-unused-vars */
export class Expo {
  static isExpoPushToken(_token: string): boolean {
    return true;
  }

  async sendPushNotificationsAsync(_messages: unknown[]): Promise<unknown[]> {
    return [];
  }
}
