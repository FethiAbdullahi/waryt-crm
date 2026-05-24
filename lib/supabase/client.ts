import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/supabase/public-env";

export function createBrowserSupabaseClient() {
  const { url, key } = getSupabasePublicEnv();

  // `next build` can prerender client modules without env; browser must still get a client instance.
  if (!url || !key) {
    return createBrowserClient("https://placeholder.supabase.co", "placeholder-key");
  }

  return createBrowserClient(url, key);
}
