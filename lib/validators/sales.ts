import { z } from "zod";
import { normalizeSaleEntryAmount } from "@/lib/sales-amount-entry";
import { warytSaleIndustrySchema } from "@/lib/sales-industries";
import type { DisplayCurrencyCode } from "@/lib/format";

export type SalesValidationMessages = {
  enterAmount: string;
  amountPositive: string;
  pickCustomerOrName: string;
  pickCustomer: string;
  pickDate: string;
  pickPipelineCustomer: string;
  pickCashOrCheque: string;
  pickCreditDue: string;
};

const defaultSalesMessages: SalesValidationMessages = {
  enterAmount: "Enter an amount",
  amountPositive: "Amount must be greater than 0",
  pickCustomerOrName: "Pick a pipeline customer or enter a customer name",
  pickCustomer: "Pick a pipeline customer",
  pickDate: "Pick a date",
  pickPipelineCustomer: "Choose a company from your pipeline to continue.",
  pickCashOrCheque: "Choose Cash or Cheque for a full-amount sale.",
  pickCreditDue: "Set when payment is due for this credit sale.",
};

export function buildQuickSaleSchema(msgs: SalesValidationMessages) {
  return z
    .object({
      prospect_id: z.string().min(1, msgs.pickPipelineCustomer),
      pipeline_sync: z.enum(["won_paying", "log_only"]).optional(),
      sale_collection_type: z.enum(["full_amount", "credit"]),
      payment_method: z.enum(["cash", "cheque", "credit"]).optional(),
      payment_due_date: z.string().optional(),
      credit_notes: z.string().max(2000).optional().nullable(),
      amount_currency: z
        .string()
        .optional()
        .transform(() => "ETB" as const satisfies DisplayCurrencyCode),
      amount: z
        .string()
        .min(1, msgs.enterAmount)
        .transform((v) => Number(String(v).replace(/,/g, "")))
        .pipe(z.number().positive(msgs.amountPositive)),
    })
    .superRefine((data, ctx) => {
      const pid = data.prospect_id.trim();
      if (!z.string().uuid().safeParse(pid).success) {
        ctx.addIssue({
          code: "custom",
          message: msgs.pickPipelineCustomer,
          path: ["prospect_id"],
        });
      }
      if (data.sale_collection_type === "full_amount") {
        if (data.payment_method !== "cash" && data.payment_method !== "cheque") {
          ctx.addIssue({
            code: "custom",
            message: msgs.pickCashOrCheque,
            path: ["payment_method"],
          });
        }
      } else {
        const due = (data.payment_due_date ?? "").trim();
        if (!due) {
          ctx.addIssue({
            code: "custom",
            message: msgs.pickCreditDue,
            path: ["payment_due_date"],
          });
        }
      }
    })
    .transform((data) => {
      const pid = data.prospect_id.trim();
      const mode = data.pipeline_sync ?? "won_paying";
      const syncWonPaying = mode === "won_paying";
      const unit = "ETB" as const;
      const isCredit = data.sale_collection_type === "credit";
      const paymentMethod: "credit" | "cash" | "cheque" = isCredit
        ? "credit"
        : (data.payment_method as "cash" | "cheque");
      const due = (data.payment_due_date ?? "").trim();
      const { amount, currency } = normalizeSaleEntryAmount(data.amount, unit);
      return {
        prospect_id: pid,
        amount,
        amount_currency: currency,
        sync_won_paying: syncWonPaying,
        sale_collection_type: data.sale_collection_type,
        payment_method: paymentMethod,
        payment_due_date: isCredit ? due : null,
        credit_notes: isCredit ? (data.credit_notes?.trim() ? data.credit_notes.trim() : null) : null,
      };
    });
}

export function buildFullSaleSchema(msgs: SalesValidationMessages) {
  return z
    .object({
      user_id: z.string().uuid(),
      prospect_id: z.preprocess(
        (v) => (v === "" || v === undefined ? null : v),
        z.union([z.string().uuid(), z.null()]),
      ),
      industry: warytSaleIndustrySchema,
      sale_collection_type: z.enum(["full_amount", "credit"]),
      payment_method: z.enum(["cash", "cheque", "credit"]).optional(),
      payment_due_date: z.string().max(32).optional().nullable(),
      credit_notes: z.string().max(2000).optional().nullable(),
      amount_currency: z
        .string()
        .optional()
        .transform(() => "ETB" as const satisfies DisplayCurrencyCode),
      amount: z
        .union([z.string(), z.number()])
        .transform((v) => {
          const n = typeof v === "string" ? Number(String(v).replace(/,/g, "")) : Number(v);
          return Number.isFinite(n) ? n : NaN;
        })
        .pipe(z.number({ error: msgs.enterAmount }).positive(msgs.amountPositive)),
      customer_name: z.string().max(200).optional().nullable(),
      notes: z.string().max(2000).optional().nullable(),
      sale_date: z.string().min(1, msgs.pickDate),
    })
    .superRefine((data, ctx) => {
      if (!data.prospect_id) {
        ctx.addIssue({
          code: "custom",
          message: msgs.pickPipelineCustomer,
          path: ["prospect_id"],
        });
      }
      if (data.sale_collection_type === "full_amount") {
        if (data.payment_method !== "cash" && data.payment_method !== "cheque") {
          ctx.addIssue({
            code: "custom",
            message: msgs.pickCashOrCheque,
            path: ["payment_method"],
          });
        }
      } else {
        const due = (data.payment_due_date ?? "").trim();
        if (!due) {
          ctx.addIssue({
            code: "custom",
            message: msgs.pickCreditDue,
            path: ["payment_due_date"],
          });
        }
      }
    })
    .transform((data) => {
      const isCredit = data.sale_collection_type === "credit";
      const paymentMethod: "credit" | "cash" | "cheque" = isCredit
        ? "credit"
        : (data.payment_method as "cash" | "cheque");
      const due = (data.payment_due_date ?? "").trim();
      const { amount, currency } = normalizeSaleEntryAmount(data.amount, data.amount_currency);
      return {
        user_id: data.user_id,
        prospect_id: data.prospect_id,
        industry: data.industry,
        amount,
        amount_currency: currency,
        customer_name: data.customer_name,
        notes: data.notes,
        sale_date: data.sale_date,
        sale_collection_type: data.sale_collection_type,
        payment_method: paymentMethod,
        payment_due_date: isCredit ? due : null,
        credit_notes: isCredit ? (data.credit_notes?.trim() ? data.credit_notes.trim() : null) : null,
      };
    });
}

const quickSaleSchema = buildQuickSaleSchema(defaultSalesMessages);
const fullSaleSchema = buildFullSaleSchema(defaultSalesMessages);

export type QuickSaleFormValues = z.input<typeof quickSaleSchema>;
export type QuickSaleValues = z.output<typeof quickSaleSchema>;
export type FullSaleFormValues = z.input<typeof fullSaleSchema>;
export type FullSaleValues = z.output<typeof fullSaleSchema>;

export { quickSaleSchema, fullSaleSchema };
