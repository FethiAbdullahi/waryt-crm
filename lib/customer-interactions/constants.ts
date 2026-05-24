export const CUSTOMER_SEGMENTS = ["b2b", "b2c"] as const;

export const INTERACTION_APPROVAL_STATUSES = ["draft", "submitted", "approved", "rejected"] as const;

export const PRODUCT_CATEGORIES = [
  "Living room",
  "Bedroom",
  "Dining",
  "Office",
  "Outdoor",
  "Storage",
  "Decor",
  "Other",
] as const;

export function labelCustomerSegment(s: string): string {
  return s === "b2b" ? "B2B" : s === "b2c" ? "B2C" : s;
}

export function labelApprovalStatus(s: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    submitted: "Pending review",
    approved: "Approved",
    rejected: "Rejected",
  };
  return map[s] ?? s;
}

export function yesNoLabel(v: boolean | null | undefined): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}
