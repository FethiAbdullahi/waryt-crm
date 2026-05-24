import { z } from "zod";

const purchasedItemSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  product_name: z.string().min(1, "Product name is required").max(300),
  quantity: z.coerce.number().positive("Quantity must be positive"),
});

export const interactionFormSchema = z
  .object({
    prospect_id: z.string().uuid().nullable().optional(),
    interaction_date: z.string().min(1, "Date is required"),
    customer_name: z.string().min(1, "Customer name is required").max(300),
    contact_phone: z.string().max(40),
    contact_email: z
      .string()
      .max(254)
      .refine((s) => !s.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()), {
        message: "Invalid email",
      }),
    customer_segment: z.enum(["b2b", "b2c"]),
    made_purchase: z.boolean(),
    primary_product_id: z.string().uuid().nullable().optional(),
    primary_product_notes: z.string().max(500),
    stock_sufficient: z.boolean().nullable().optional(),
    internal_notes: z.string().max(8000),
    feedback_concerns: z.string().max(4000),
    alternative_offered: z.boolean().nullable().optional(),
    alternative_description: z.string().max(2000),
    follow_up_back_in_stock: z.boolean().nullable().optional(),
    follow_up_product_id: z.string().uuid().nullable().optional(),
    follow_up_notes: z.string().max(2000),
    segment_ids: z.array(z.string().uuid()),
    purchased_items: z.array(purchasedItemSchema),
    approval_status: z.enum(["draft", "submitted"]),
  })
  .superRefine((data, ctx) => {
    if (data.made_purchase && data.purchased_items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one purchased item when purchase was made",
        path: ["purchased_items"],
      });
    }
    if (!data.made_purchase) {
      if (data.alternative_offered == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Indicate whether an alternative was offered",
          path: ["alternative_offered"],
        });
      }
      if (data.follow_up_back_in_stock == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Indicate follow-up interest for back in stock",
          path: ["follow_up_back_in_stock"],
        });
      }
    }
    if (data.stock_sufficient == null && data.made_purchase) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indicate whether stock was sufficient",
        path: ["stock_sufficient"],
      });
    }
  });

export type InteractionFormValues = z.infer<typeof interactionFormSchema>;

export const productFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  category: z.string().max(120),
  stock_quantity: z.coerce.number().min(0),
  is_in_stock: z.boolean(),
  active: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(9999),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
