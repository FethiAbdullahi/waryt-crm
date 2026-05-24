export type UserRole = "admin" | "super_admin" | "manager" | "agent";

export type Profile = {
  id: string;
  display_name: string;
  role: UserRole;
  avatar_url: string | null;
  notification_prefs: Record<string, unknown> | null;
  created_at: string;
};

export type Team = {
  id: string;
  name: string;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  category: string | null;
  stock_quantity: number;
  is_in_stock: boolean;
};

export type CustomerSegment = "b2b" | "b2c";

export type InteractionApprovalStatus = "draft" | "submitted" | "approved" | "rejected";

export type InteractionPurchasedItem = {
  id: string;
  interaction_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  sort_order: number;
};

export type CustomerInteraction = {
  id: string;
  user_id: string;
  team_id: string | null;
  prospect_id: string | null;
  interaction_date: string;
  customer_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  customer_segment: CustomerSegment;
  made_purchase: boolean;
  primary_product_id: string | null;
  primary_product_notes: string | null;
  stock_sufficient: boolean | null;
  internal_notes: string | null;
  feedback_concerns: string | null;
  alternative_offered: boolean | null;
  alternative_description: string | null;
  follow_up_back_in_stock: boolean | null;
  follow_up_product_id: string | null;
  follow_up_notes: string | null;
  approval_status: InteractionApprovalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  /** When selected with embed */
  profiles?: { display_name?: string | null } | { display_name?: string | null }[] | null;
  interaction_purchased_items?: InteractionPurchasedItem[];
  interaction_segment_tags?: { segment_id: string; marketing_segments?: { name: string; category: string } | { name: string; category: string }[] }[];
};

export type MarketingSegment = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  active: boolean;
  created_at: string;
};

export type SaleCollectionType = "full_amount" | "credit";

export type SalePaymentMethod = "credit" | "cash" | "cheque";

export type SalesEntry = {
  id: string;
  team_id: string | null;
  user_id: string;
  industry: string;
  prospect_id: string | null;
  amount: number;
  /** Currency for `amount` — always ETB (`sales_entries.amount_currency`). */
  amount_currency: string;
  customer_name: string | null;
  notes: string | null;
  sale_date: string;
  /** Full amount (cash/cheque) vs credit sale. */
  sale_collection_type: SaleCollectionType;
  payment_method: SalePaymentMethod;
  /** When `sale_collection_type` is credit — expected collection date. */
  payment_due_date: string | null;
  /** Optional: days from sale_date used to pick `payment_due_date`. */
  credit_term_days: number | null;
  /** Set when credit is collected (clears overdue state). */
  credit_collected_at: string | null;
  credit_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Target = {
  id: string;
  scope: "user" | "team";
  user_id: string | null;
  team_id: string | null;
  period: "daily" | "weekly" | "monthly";
  starts_on: string;
  ends_on: string;
  amount: number;
  created_at?: string;
};

export type TargetEditHistoryRow = {
  id: string;
  created_at: string;
  edited_by: string;
  previous: Record<string, unknown>;
  next: Record<string, unknown>;
};

export type Challenge = {
  id: string;
  title: string;
  description: string | null;
  metric: string;
  starts_at: string;
  ends_at: string;
  created_by: string | null;
  status: "draft" | "active" | "completed" | "cancelled";
};

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  read_at: string | null;
  created_at: string;
};

export type StudioProspect = {
  id: string;
  owner_id: string;
  /** Set when pipeline loads owner embed (admin / super_admin). */
  owner_display_name?: string | null;
  team_id: string | null;
  /** When `teams(name)` is selected with the row. */
  team_name?: string | null;
  business_name: string;
  contact_name: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  industry: string;
  company_size_band: string;
  stage: string;
  account_status: string;
  interested_modules: string | null;
  pain_points: string | null;
  pricing_notes: string | null;
  mrr_monthly: number;
  /** Optional deal size when stage is won (stored as ETB). */
  closed_deal_amount?: number | null;
  closed_deal_at: string | null;
  renewal_on: string | null;
  credit_expires_on: string | null;
  needs_cs_attention: boolean;
  created_at: string;
  updated_at: string;
};

export type StudioActivity = {
  id: string;
  prospect_id: string;
  user_id: string;
  channel: string;
  body: string;
  created_at: string;
};

export type StudioInsight = {
  id: string;
  user_id: string;
  category: string;
  title: string;
  body: string | null;
  is_shared: boolean;
  created_at: string;
};

export type StudioAlert = {
  id: string;
  user_id: string;
  prospect_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  due_on: string;
  resolved_at: string | null;
  created_at: string;
  /** `auto` = pipeline rules; `manual` = user-created reminder. */
  source?: string;
};

export type CustomerSatisfactionReview = {
  id: string;
  user_id: string;
  rating: number;
  sale_id: string | null;
  prospect_id: string | null;
  customer_name: string;
  created_at: string;
};

export type SatisfactionSummaryRow = {
  user_id: string;
  avg_rating: number | string;
  review_count: number | string;
};
