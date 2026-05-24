import { z } from "zod";
import { LEAD_INDUSTRIES } from "@/lib/sales-studio/routes";
import { STUDIO_INDUSTRY_MAX_LEN } from "@/lib/sales-studio/industry";

/** Preset segments (suggestions). DB accepts any trimmed string up to STUDIO_INDUSTRY_MAX_LEN. */
export const WARYT_SALE_INDUSTRIES = LEAD_INDUSTRIES;

export type WarytSaleIndustry = string;

/** Sale / subscription industry tag — free text with length cap (matches DB). */
export const warytSaleIndustrySchema = z
  .string()
  .trim()
  .min(1, "Industry is required")
  .max(STUDIO_INDUSTRY_MAX_LEN, `At most ${STUDIO_INDUSTRY_MAX_LEN} characters`);

/** Normalize a sale / pipeline industry tag for storage (DB length cap). */
export function coerceSaleIndustryTag(v: string | null | undefined, fallback = WARYT_SALE_INDUSTRIES[0]): string {
  const t = (v ?? "").trim();
  if (!t) return fallback;
  return t.slice(0, STUDIO_INDUSTRY_MAX_LEN);
}
