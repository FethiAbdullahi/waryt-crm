import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseUrlKeyForNodeServer } from "@/lib/supabase/server-credentials";

function callbackOrigin(request: NextRequest): string {
  const requestUrl = new URL(request.url);
  let origin = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (!origin) {
    const host = request.headers.get("host");
    const proto =
      request.headers.get("x-forwarded-proto") ||
      (requestUrl.protocol === "https:" ? "https" : "http");
    origin = host ? `${proto}://${host}` : requestUrl.origin;
  }
  return origin;
}

export async function GET(request: NextRequest) {
  const origin = callbackOrigin(request);
  const redirectTo = `${origin}/auth/callback`;

  const { url, key } = getSupabaseUrlKeyForNodeServer();
  if (!url || !key) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  return NextResponse.redirect(data.url);
}
