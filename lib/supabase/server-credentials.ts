import {
  loadSupabasePublicIntoProcess,
  readSupabasePublicDirectFromDisk,
} from "@/lib/env/hydrate-env-local";
import {
  envKeyNextPublicSupabaseAnonKey,
  envKeyNextPublicSupabaseUrl,
  envKeySupabaseAnonKey,
  envKeySupabaseUrl,
} from "@/lib/supabase/runtime-env";

function trimDequote(v: string | undefined): string {
  if (v == null) return "";
  let s = v.trim().replace(/^\uFEFF/, "");
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function pickUrlKey(url: string, key: string) {
  return {
    url: trimDequote(url).replace(/\/+$/, ""),
    key: trimDequote(key),
  };
}

/**
 * Supabase URL + anon key for Node (Server Actions, Route Handlers, server components).
 * Does not use `getSupabasePublicEnv()` — Next can inline `NEXT_PUBLIC_*` to empty strings
 * in server bundles; we read via dynamic keys + optional `SUPABASE_*` + disk fallback.
 */
export function getSupabaseUrlKeyForNodeServer(): { url: string; key: string } {
  const readServerPair = () =>
    pickUrlKey(
      process.env[envKeySupabaseUrl()] ?? "",
      process.env[envKeySupabaseAnonKey()] ?? "",
    );

  const readNextPair = () =>
    pickUrlKey(
      process.env[envKeyNextPublicSupabaseUrl()] ?? "",
      process.env[envKeyNextPublicSupabaseAnonKey()] ?? "",
    );

  let { url, key } = readServerPair();
  if (url && key) return { url, key };

  ({ url, key } = readNextPair());
  if (url && key) return { url, key };

  loadSupabasePublicIntoProcess();

  ({ url, key } = readServerPair());
  if (url && key) return { url, key };

  ({ url, key } = readNextPair());
  if (url && key) return { url, key };

  ({ url, key } = readSupabasePublicDirectFromDisk());
  if (url && key) {
    process.env[envKeyNextPublicSupabaseUrl()] = url;
    process.env[envKeyNextPublicSupabaseAnonKey()] = key;
    process.env[envKeySupabaseUrl()] = url;
    process.env[envKeySupabaseAnonKey()] = key;
    return { url, key };
  }

  return { url: "", key: "" };
}
