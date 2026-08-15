import path from "node:path";
import type { ExpoConfig } from "expo/config";
import { config as loadEnv } from "dotenv";

// Repo-root .env holds the values (same file apps/api and apps/web read) so
// we don't duplicate secrets across a second apps/mobile/.env file.
loadEnv({ path: path.resolve(__dirname, "../../.env") });

const config: ExpoConfig = {
  name: "FieldFlow",
  slug: "fieldflow-mobile",
  scheme: "fieldflow",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  plugins: ["expo-router", "expo-sqlite"],
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
  },
  extra: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    apiUrl: process.env.MOBILE_API_URL ?? "http://localhost:3000",
  },
};

export default config;
