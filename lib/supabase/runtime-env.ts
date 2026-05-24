/**
 * Build env keys at runtime so Next/SWC cannot replace `process.env.NEXT_PUBLIC_*`
 * with empty compile-time literals in server chunks.
 */
export function envKeyNextPublicSupabaseUrl(): string {
  return ["NEXT", "PUBLIC", "SUPABASE", "URL"].join("_");
}

export function envKeyNextPublicSupabaseAnonKey(): string {
  return ["NEXT", "PUBLIC", "SUPABASE", "ANON", "KEY"].join("_");
}

export function envKeySupabaseUrl(): string {
  return ["SUPABASE", "URL"].join("_");
}

export function envKeySupabaseAnonKey(): string {
  return ["SUPABASE", "ANON", "KEY"].join("_");
}
