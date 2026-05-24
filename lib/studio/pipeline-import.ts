import * as XLSX from "xlsx";
import { STUDIO_INDUSTRY_MAX_LEN } from "@/lib/sales-studio/industry";
import { COMPANY_SIZE_BANDS, STUDIO_ACCOUNT_STATUS, STUDIO_STAGES } from "@/lib/sales-studio/routes";

export type PipelineImportInsertRow = {
  business_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  industry: string;
  company_size_band: string;
  stage: string;
  account_status: string;
  interested_modules: string | null;
  pain_points: string | null;
  pricing_notes: string | null;
  mrr_monthly: number;
  renewal_on: string | null;
  credit_expires_on: string | null;
  needs_cs_attention: boolean;
};

/** Stable keys for UI translation (see `studioPipeline.importIssues` in messages). */
export type PipelineImportIssueKey =
  | "READ_FAILED"
  | "NO_SHEETS"
  | "NEED_HEADER_ROW"
  | "NO_COLUMNS"
  | "BUSINESS_REQUIRED"
  | "INDUSTRY_LENGTH"
  | "COMPANY_SIZE_INVALID"
  | "STAGE_INVALID"
  | "ACCOUNT_STATUS_INVALID"
  | "CREDIT_NEGATIVE"
  | "SKIPPED_NO_BUSINESS";

export type PipelineImportIssue = {
  rowNumber: number;
  key: PipelineImportIssueKey;
  params?: Record<string, string | number>;
};

export type PipelineImportParseResult = {
  rows: PipelineImportInsertRow[];
  issues: PipelineImportIssue[];
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/** Map spreadsheet header cell to canonical field name. */
function headerToField(header: string): keyof PipelineImportInsertRow | null {
  const k = normalizeHeader(header);
  const map: Record<string, keyof PipelineImportInsertRow> = {
    business_name: "business_name",
    business: "business_name",
    company: "business_name",
    account: "business_name",
    businessname: "business_name",
    contact_name: "contact_name",
    contact: "contact_name",
    contactperson: "contact_name",
    contact_email: "contact_email",
    email: "contact_email",
    contact_phone: "contact_phone",
    phone: "contact_phone",
    mobile: "contact_phone",
    industry: "industry",
    company_size_band: "company_size_band",
    size: "company_size_band",
    company_size: "company_size_band",
    staff: "company_size_band",
    companysize: "company_size_band",
    stage: "stage",
    account_status: "account_status",
    status: "account_status",
    interested_modules: "interested_modules",
    modules: "interested_modules",
    features_of_interest: "interested_modules",
    features: "interested_modules",
    pain_points: "pain_points",
    pain: "pain_points",
    pricing_notes: "pricing_notes",
    pricing: "pricing_notes",
    mrr_monthly: "mrr_monthly",
    mrr: "mrr_monthly",
    credit_base: "mrr_monthly",
    credit: "mrr_monthly",
    renewal_on: "renewal_on",
    renewal: "renewal_on",
    credit_expires_on: "credit_expires_on",
    credit_expiry: "credit_expires_on",
    credit_expires: "credit_expires_on",
    needs_cs_attention: "needs_cs_attention",
    cs_flag: "needs_cs_attention",
    flag_cs: "needs_cs_attention",
  };
  return map[k] ?? null;
}

function toYmd(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s.length >= 8 ? s.slice(0, 10) : null;
}

function parseBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "y";
}

function parseNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(/,/g, "");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function isEmptyRow(cells: unknown[]): boolean {
  return cells.every((c) => c === "" || c == null || (typeof c === "string" && c.trim() === ""));
}

function validateRow(row: PipelineImportInsertRow, rowNumber: number): PipelineImportIssue | null {
  if (!row.business_name.trim()) {
    return { rowNumber, key: "BUSINESS_REQUIRED" };
  }
  const ind = row.industry.trim();
  if (!ind.length || ind.length > STUDIO_INDUSTRY_MAX_LEN) {
    return {
      rowNumber,
      key: "INDUSTRY_LENGTH",
      params: { max: STUDIO_INDUSTRY_MAX_LEN },
    };
  }
  if (!(COMPANY_SIZE_BANDS as readonly string[]).includes(row.company_size_band)) {
    return {
      rowNumber,
      key: "COMPANY_SIZE_INVALID",
      params: { allowed: COMPANY_SIZE_BANDS.join(", ") },
    };
  }
  if (!(STUDIO_STAGES as readonly string[]).includes(row.stage)) {
    return {
      rowNumber,
      key: "STAGE_INVALID",
      params: { allowed: STUDIO_STAGES.join(", ") },
    };
  }
  if (!(STUDIO_ACCOUNT_STATUS as readonly string[]).includes(row.account_status)) {
    return {
      rowNumber,
      key: "ACCOUNT_STATUS_INVALID",
      params: { allowed: STUDIO_ACCOUNT_STATUS.join(", ") },
    };
  }
  if (row.mrr_monthly < 0) {
    return { rowNumber, key: "CREDIT_NEGATIVE" };
  }
  return null;
}

/** Parse first worksheet from CSV or Excel into prospect insert rows. */
export function parsePipelineImportWorkbook(buf: ArrayBuffer): PipelineImportParseResult {
  const issues: PipelineImportIssue[] = [];
  const rows: PipelineImportInsertRow[] = [];

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array", cellDates: true });
  } catch {
    return { rows: [], issues: [{ rowNumber: 0, key: "READ_FAILED" }] };
  }
  const name = wb.SheetNames[0];
  if (!name) {
    return { rows: [], issues: [{ rowNumber: 0, key: "NO_SHEETS" }] };
  }
  const sheet = wb.Sheets[name];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  if (matrix.length < 2) {
    return {
      rows: [],
      issues: [{ rowNumber: 0, key: "NEED_HEADER_ROW" }],
    };
  }

  const headerCells = (matrix[0] ?? []).map((c) => String(c ?? ""));
  const colToField: (keyof PipelineImportInsertRow | null)[] = headerCells.map((h) => headerToField(h));

  if (!colToField.some(Boolean)) {
    return {
      rows: [],
      issues: [{ rowNumber: 1, key: "NO_COLUMNS" }],
    };
  }

  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    const cells = colToField.map((_, j) => line[j] ?? "");
    if (isEmptyRow(cells)) continue;

    const rec: Partial<PipelineImportInsertRow> = {
      company_size_band: "1-10",
      stage: "new",
      account_status: "active_prospect",
      contact_email: null,
      contact_phone: null,
      interested_modules: null,
      pain_points: null,
      pricing_notes: null,
      mrr_monthly: 0,
      renewal_on: null,
      credit_expires_on: null,
      needs_cs_attention: false,
    };

    for (let j = 0; j < colToField.length; j++) {
      const field = colToField[j];
      if (!field) continue;
      const raw = line[j];
      if (raw === "" || raw == null) continue;

      if (field === "mrr_monthly") {
        rec.mrr_monthly = parseNum(raw);
      } else if (field === "needs_cs_attention") {
        rec.needs_cs_attention = parseBool(raw);
      } else if (field === "renewal_on" || field === "credit_expires_on") {
        rec[field] = toYmd(raw);
      } else if (
        field === "business_name" ||
        field === "contact_name" ||
        field === "contact_email" ||
        field === "contact_phone" ||
        field === "industry" ||
        field === "company_size_band" ||
        field === "stage" ||
        field === "account_status" ||
        field === "interested_modules" ||
        field === "pain_points" ||
        field === "pricing_notes"
      ) {
        const t = String(raw).trim();
        if (
          field === "contact_name" ||
          field === "contact_email" ||
          field === "contact_phone" ||
          field === "interested_modules" ||
          field === "pain_points" ||
          field === "pricing_notes"
        ) {
          (rec as Record<string, unknown>)[field] = t ? t : null;
        } else {
          (rec as Record<string, unknown>)[field] = t;
        }
      }
    }

    const rowNumber = i + 1;
    const business_name = String(rec.business_name ?? "").trim();
    if (!business_name) {
      issues.push({ rowNumber, key: "SKIPPED_NO_BUSINESS" });
      continue;
    }

    const row: PipelineImportInsertRow = {
      business_name,
      contact_name: (rec.contact_name as string | null | undefined) ?? null,
      contact_email: (rec.contact_email as string | null | undefined) ?? null,
      contact_phone: (rec.contact_phone as string | null | undefined) ?? null,
      industry: (() => {
        const raw = String(rec.industry ?? "").trim();
        return raw.length > 0 ? raw.slice(0, STUDIO_INDUSTRY_MAX_LEN) : "Other";
      })(),
      company_size_band: String(rec.company_size_band ?? "1-10"),
      stage: String(rec.stage ?? "new"),
      account_status: String(rec.account_status ?? "active_prospect"),
      interested_modules: rec.interested_modules ?? null,
      pain_points: rec.pain_points ?? null,
      pricing_notes: rec.pricing_notes ?? null,
      mrr_monthly: Number(rec.mrr_monthly ?? 0),
      renewal_on: rec.renewal_on ?? null,
      credit_expires_on: rec.credit_expires_on ?? null,
      needs_cs_attention: Boolean(rec.needs_cs_attention),
    };

    const err = validateRow(row, rowNumber);
    if (err) {
      issues.push(err);
      continue;
    }
    rows.push(row);
  }

  return { rows, issues };
}

/** Canonical English headers (required for parsing). Columns mirror the new-lead form + optional commercial fields. */
export const PIPELINE_IMPORT_TEMPLATE_CSV = [
  "business_name,contact_name,contact_email,contact_phone,industry,company_size_band,stage,account_status,interested_modules,pain_points,mrr_monthly,renewal_on,credit_expires_on,pricing_notes,needs_cs_attention",
  "Acme Trading PLC,Jane Doe,jane@acme.et,+251911000000,SMEs,1-10,new,active_prospect,\"Sofas, delivery\",Price sensitivity,0,,,,false",
  "Beta School,,info@beta.edu,,Schools,11-25,qualified,active_prospect,,,1500,,,,false",
  "Gamma Health,,,+251922000000,Healthcare / clinics,11-25,new,active_prospect,,,0,,,,false",
].join("\n");
