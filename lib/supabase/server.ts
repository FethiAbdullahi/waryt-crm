import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseUrlKeyForNodeServer } from "@/lib/supabase/server-credentials";

export async function createClient() {
  const cookieStore = await cookies();
  const { url: envUrl, key: envKey } = getSupabaseUrlKeyForNodeServer();
  const url = envUrl || "https://placeholder.supabase.co";
  const key = envKey || "placeholder-key";

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; middleware will refresh session.
          }
        },
      },
    },
  );
}
