import {
  envKeyNextPublicSupabaseAnonKey,
  envKeyNextPublicSupabaseUrl,
} from "@/lib/supabase/runtime-env";

/**
 * Read Supabase public env with common .env formatting issues fixed
 * (BOM, wrapping quotes, trailing slashes on URL).
 *
 * Uses static `process.env.NEXT_PUBLIC_*` first so browser bundles receive
 * values Next inlines from `next.config` / `.env.local`. Falls back to dynamic
 * keys for server/middleware where static access can compile to empty literals.
 */
export function getSupabasePublicEnv(): { url: string; key: string } {
  const trimAndDequote = (v: string | undefined) => {
    if (v == null) return "";
    let s = v.trim().replace(/^\uFEFF/, "");
    s = s.replace(/\s+#.*$/, "");
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))
    ) {
      s = s.slice(1, -1).trim();
    }
    return s;
  };

  // Browser bundles: Next inlines `process.env.NEXT_PUBLIC_*` on static member access only.
  // Server/middleware: static access can be compiled to empty; dynamic keys still read real env.
  let url = trimAndDequote(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
  let key = trimAndDequote(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !key) {
    url = trimAndDequote(
      process.env[envKeyNextPublicSupabaseUrl() as keyof NodeJS.ProcessEnv] as
        | string
        | undefined,
    ).replace(/\/+$/, "");
    key = trimAndDequote(
      process.env[envKeyNextPublicSupabaseAnonKey() as keyof NodeJS.ProcessEnv] as
        | string
        | undefined,
    );
  }

  return { url, key };
}
