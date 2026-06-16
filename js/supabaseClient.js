import { APP_CONFIG } from "./config.js";

const sdkUrl = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const { createClient } = await import(sdkUrl);

if (!APP_CONFIG?.supabaseUrl || !APP_CONFIG?.supabaseAnonKey) {
  throw new Error(
    "Missing Supabase config. Copy js/config.example.js to js/config.js and fill credentials."
  );
}

export const supabase = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);
