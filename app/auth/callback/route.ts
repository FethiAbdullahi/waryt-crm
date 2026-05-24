import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isWarytGoogleEmailAllowed } from "@/lib/auth/waryt-allowlist";
import { getSupabaseUrlKeyForNodeServer } from "@/lib/supabase/server-credentials";

function isGoogleProviderSession(
  user: {
    app_metadata?: Record<string, unknown>;
    identities?: { provider?: string }[];
  } | null,
): boolean {
  if (!user) return false;
  const meta = user.app_metadata as { provider?: unknown } | undefined;
  if (meta?.provider === "google") return true;
  const ids = user.identities;
  if (Array.isArray(ids) && ids.length === 1 && ids[0]?.provider === "google") {
    return true;
  }
  return false;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  // Robust origin detection:
  // 1. Use NEXT_PUBLIC_BASE_URL if set (common in Docker/CI)
  // 2. Fallback to Host + X-Forwarded-Proto headers
  // 3. Last resort: requestUrl.origin
  let origin = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (!origin) {
    const host = request.headers.get("host");
    const proto =
      request.headers.get("x-forwarded-proto") ||
      (requestUrl.protocol === "https:" ? "https" : "http");
    if (host) {
      origin = `${proto}://${host}`;
    } else {
      origin = requestUrl.origin;
    }
  }

  if (code) {
    const cookieStore = await cookies();
    const { url, key } = getSupabaseUrlKeyForNodeServer();

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (isGoogleProviderSession(user) && !isWarytGoogleEmailAllowed(user?.email)) {
        await supabase.auth.signOut();
        const q = new URLSearchParams({ error: "forbidden" });
        if (next && next !== "/") q.set("next", next);
        return NextResponse.redirect(`${origin}/login?${q.toString()}`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
