import { LEAD_INDUSTRIES } from "@/lib/sales-studio/routes";

export type LeadIndustryPreset = (typeof LEAD_INDUSTRIES)[number];

const PRESET_SET = new Set<string>(LEAD_INDUSTRIES as readonly string[]);

/** Map stored DB value back to preset + optional "Other" detail field. */
export function splitStudioIndustry(stored: string): { preset: LeadIndustryPreset; other: string } {
  const s = stored.trim();
  if (PRESET_SET.has(s)) {
    return { preset: s as LeadIndustryPreset, other: "" };
  }
  return { preset: "Other", other: s };
}

/** Persist one `industry` string for studio_prospects. */
export function resolveStudioIndustry(preset: LeadIndustryPreset, other: string): string {
  if (preset !== "Other") return preset;
  const t = other.trim();
  return t.length > 0 ? t.slice(0, 120) : "Other";
}

export const STUDIO_INDUSTRY_MAX_LEN = 120;
