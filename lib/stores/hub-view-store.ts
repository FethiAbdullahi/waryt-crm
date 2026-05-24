import { create } from "zustand";
import { toast } from "sonner";
import { canAccessReports } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

export type HubView = "home" | "reports";

/** Hub view from URL, or `null` when not on the hub shell (e.g. `/sales`, `/settings`). */
export function deriveHubViewFromLocation(): HubView | null {
  if (typeof window === "undefined") return null;
  const p = window.location.pathname;
  if (p.startsWith("/sales")) return null;

  const app = new URLSearchParams(window.location.search).get("app");
  if (app === "reports") return "reports";
  if (p === "/reports" || p.startsWith("/reports/")) return "reports";
  if (p === "/" || p === "") return "home";
  return null;
}

type HubState = {
  view: HubView;
  boot: (v: HubView) => void;
  /** Must use App Router navigation (e.g. `router.push`) so leaving `/sales` actually swaps layouts. */
  goHubView: (
    next: HubView,
    role: UserRole,
    navigate: (path: string) => void,
    options?: { blockedReportsMessage?: string },
  ) => void;
};

export const useHubViewStore = create<HubState>((set) => ({
  view: "home",
  boot: (v) => set({ view: v }),
  goHubView: (next, role, navigate, options) => {
    if (next === "reports" && !canAccessReports(role)) {
      toast.error(options?.blockedReportsMessage ?? "You do not have access to reports.");
      return;
    }
    const path = next === "home" ? "/" : "/reports";
    navigate(path);
    set({ view: next });
  },
}));
