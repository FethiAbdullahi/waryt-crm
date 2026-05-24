import { z } from "zod";
import {
  COMPANY_SIZE_BANDS,
  LEAD_INDUSTRIES,
  STUDIO_ACCOUNT_STATUS,
  STUDIO_ACTIVITY_CHANNELS,
  STUDIO_ALERT_KINDS,
  STUDIO_INSIGHT_CATEGORIES,
  STUDIO_STAGES,
} from "@/lib/sales-studio/routes";

const industryPreset = z.enum(LEAD_INDUSTRIES);
const industryOther = z.string().max(120);
const stage = z.enum(STUDIO_STAGES);
const accountStatus = z.enum(STUDIO_ACCOUNT_STATUS);
const sizeBand = z.enum(COMPANY_SIZE_BANDS);
const channel = z.enum(STUDIO_ACTIVITY_CHANNELS);
const insightCategory = z.enum(STUDIO_INSIGHT_CATEGORIES);
const alertKind = z.enum(STUDIO_ALERT_KINDS);

export type StudioValidationMessages = {
  businessNameRequired: string;
  invalidEmail: string;
  invalidTeam: string;
  creditNonNegative: string;
  amountNonNegative: string;
  activityBody: string;
  titleRequired: string;
  pickDueDate: string;
};

const defaultStudioMessages: StudioValidationMessages = {
  businessNameRequired: "Business name is required",
  invalidEmail: "Invalid email",
  invalidTeam: "Choose a valid sales team",
  creditNonNegative: "Credit base cannot be negative",
  amountNonNegative: "Amount cannot be negative",
  activityBody: "Add a note or summary",
  titleRequired: "Title is required",
  pickDueDate: "Pick a due date",
};

export function buildStudioProspectFormSchema(msgs: StudioValidationMessages) {
  return z.object({
    business_name: z.string().min(1, msgs.businessNameRequired).max(300),
    contact_name: z.string().max(200),
    contact_email: z
      .string()
      .max(254)
      .refine((s) => !s.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()), {
        message: msgs.invalidEmail,
      }),
    contact_phone: z.string().max(40),
    team_id: z
      .string()
      .max(40)
      .refine(
        (s) => {
          const t = s.trim();
          if (!t) return true;
          return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
        },
        { message: msgs.invalidTeam },
      ),
    industry_preset: industryPreset,
    industry_other: industryOther,
    company_size_band: sizeBand,
    stage,
    account_status: accountStatus,
    interested_modules: z.string().max(4000),
    pain_points: z.string().max(4000),
    pricing_notes: z.string().max(4000),
    mrr_monthly: z.preprocess(
      (v) => {
        const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v);
        return Number.isFinite(n) ? n : 0;
      },
      z.number().min(0, msgs.creditNonNegative),
    ),
    renewal_on: z.string().max(32),
    credit_expires_on: z.string().max(32),
    needs_cs_attention: z.boolean(),
    won_deal_amount: z.preprocess(
      (v) => {
        const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v);
        return Number.isFinite(n) ? n : 0;
      },
      z.number().min(0, msgs.amountNonNegative),
    ),
  });
}

export function buildStudioActivitySchema(msgs: StudioValidationMessages) {
  return z.object({
    prospect_id: z.string().uuid(),
    channel,
    body: z.string().min(1, msgs.activityBody).max(8000),
  });
}

export function buildStudioInsightSchema(msgs: StudioValidationMessages) {
  return z.object({
    category: insightCategory,
    title: z.string().min(1, msgs.titleRequired).max(300),
    body: z.string().max(8000),
    is_shared: z.boolean(),
  });
}

export function buildStudioAlertSchema(msgs: StudioValidationMessages) {
  return z.object({
    prospect_id: z.union([z.string().uuid(), z.null()]),
    kind: alertKind,
    title: z.string().min(1, msgs.titleRequired).max(300),
    body: z.string().max(4000),
    due_on: z.string().min(1, msgs.pickDueDate),
  });
}

export const studioProspectFormSchema = buildStudioProspectFormSchema(defaultStudioMessages);
export const studioActivitySchema = buildStudioActivitySchema(defaultStudioMessages);
export const studioInsightSchema = buildStudioInsightSchema(defaultStudioMessages);
export const studioAlertSchema = buildStudioAlertSchema(defaultStudioMessages);

export type StudioProspectFormValues = z.infer<typeof studioProspectFormSchema>;
export type StudioActivityValues = z.infer<typeof studioActivitySchema>;
export type StudioInsightValues = z.infer<typeof studioInsightSchema>;
export type StudioAlertValues = z.infer<typeof studioAlertSchema>;
