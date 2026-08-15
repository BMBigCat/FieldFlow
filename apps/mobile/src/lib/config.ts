import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  apiUrl?: string;
};

if (!extra.supabaseUrl || !extra.supabaseAnonKey) {
  // Mirrors apps/web's philosophy: don't crash over missing config, surface
  // it loudly instead — see apps/web/src/lib/supabase.ts.
  console.warn(
    "SUPABASE_URL / SUPABASE_ANON_KEY are not set in the repo-root .env — auth will not work until it's configured.",
  );
}

export const SUPABASE_URL = extra.supabaseUrl || "https://placeholder.supabase.co";
export const SUPABASE_ANON_KEY = extra.supabaseAnonKey || "placeholder-anon-key";
export const API_URL = extra.apiUrl || "http://localhost:3000";
