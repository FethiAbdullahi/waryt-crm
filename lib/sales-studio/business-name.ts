/** Normalize company names for duplicate comparison (matches SQL regexp_replace trim logic). */
export function normalizePipelineBusinessName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
