import type { UserRole } from "@/lib/types";
import { Home, LayoutDashboard, LineChart, Shield, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavLabelKey = "home" | "teams" | "admin" | "sales" | "reports";

export type NavItem = {
  href: string;
  labelKey: NavLabelKey;
  icon: LucideIcon;
  roles: UserRole[];
  /** Client-side hub switch (no RSC) — Home, Challenges, Reports. */
  hubSpa?: boolean;
};

const ALL: UserRole[] = ["admin", "super_admin", "manager", "agent"];
const ORG_ADMINS: UserRole[] = ["admin", "super_admin"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "home", icon: Home, roles: ALL, hubSpa: true },
  { href: "/teams", labelKey: "teams", icon: UsersRound, roles: ALL },
  { href: "/admin", labelKey: "admin", icon: Shield, roles: ORG_ADMINS },
  { href: "/sales", labelKey: "sales", icon: LayoutDashboard, roles: ALL },
  {
    href: "/reports",
    labelKey: "reports",
    icon: LineChart,
    roles: ALL,
    hubSpa: true,
  },
];

export function navForRole(role: UserRole) {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}
