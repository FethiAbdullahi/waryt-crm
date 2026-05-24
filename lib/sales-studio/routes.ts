import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ClipboardList,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  ListChecks,
  MessageSquarePlus,
  Table2,
  Target,
  Users,
} from "lucide-react";

export const LEAD_INDUSTRIES = [
  "SMEs",
  "Marketing agencies",
  "Schools",
  "NGOs",
  "E-commerce",
  "Retail",
  "Other",
] as const;

export const STUDIO_STAGES = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

export const STUDIO_ACCOUNT_STATUS = [
  "active_prospect",
  "paying",
  "non_paying",
  "expired",
  "churned",
] as const;

export const COMPANY_SIZE_BANDS = ["1-10", "11-25", "26-50", "51-100", "101-500", "501-1000", "1000+"] as const;

export const STUDIO_ACTIVITY_CHANNELS = ["note", "call", "email", "meeting"] as const;

export const STUDIO_INSIGHT_CATEGORIES = [
  "objection",
  "feature_request",
  "demo_win",
  "peer_share",
] as const;

export const STUDIO_ALERT_KINDS = [
  "payment_followup",
  "renewal",
  "credit_expiry",
  "cs_escalation",
  "custom",
] as const;

export const SALES_STUDIO_TAB_IDS = [
  "overview",
  "interactions",
  "pipeline",
  "prospects",
  "performance",
  "insights",
  "alerts",
  "reporting",
  "log",
  "field",
] as const;

export type SalesStudioTabId = (typeof SALES_STUDIO_TAB_IDS)[number];

export function parseSalesStudioTab(raw: string | null | undefined): SalesStudioTabId {
  const t = (raw ?? "").trim();
  if (t && (SALES_STUDIO_TAB_IDS as readonly string[]).includes(t)) return t as SalesStudioTabId;
  return "overview";
}

/** Deep link for bookmarks and `<Link>` from outside Waryt Studio (full navigation). */
export function salesStudioHref(tab: SalesStudioTabId) {
  return tab === "overview" ? "/sales" : `/sales?tab=${tab}`;
}

export type SalesStudioNavItem = {
  tab: SalesStudioTabId;
  icon: LucideIcon;
};

export const SALES_STUDIO_NAV: SalesStudioNavItem[] = [
  { tab: "overview", icon: LayoutDashboard },
  { tab: "interactions", icon: MessageSquarePlus },
  { tab: "pipeline", icon: ClipboardList },
  { tab: "prospects", icon: Users },
  { tab: "performance", icon: Target },
  { tab: "insights", icon: Lightbulb },
  { tab: "alerts", icon: Bell },
  { tab: "reporting", icon: LineChart },
  { tab: "log", icon: Table2 },
  { tab: "field", icon: ListChecks },
];

export function labelStage(stage: string) {
  const map: Record<string, string> = {
    new: "New",
    qualified: "Qualified",
    proposal: "Proposal",
    negotiation: "Negotiation",
    won: "Won",
    lost: "Lost",
  };
  return map[stage] ?? stage;
}

export function labelAccountStatus(s: string) {
  const map: Record<string, string> = {
    active_prospect: "Active prospect",
    paying: "Paying",
    non_paying: "Non-paying",
    expired: "Expired",
    churned: "Churned",
  };
  return map[s] ?? s;
}

export function labelInsightCategory(c: string) {
  const map: Record<string, string> = {
    objection: "Objection",
    feature_request: "Feature request",
    demo_win: "Demo / messaging win",
    peer_share: "Peer pattern (shared)",
  };
  return map[c] ?? c;
}

export function labelAlertKind(k: string) {
  const map: Record<string, string> = {
    payment_followup: "Payment follow-up",
    renewal: "Renewal",
    credit_expiry: "Credit expiration",
    cs_escalation: "Customer success",
    custom: "Custom",
  };
  return map[k] ?? k;
}
