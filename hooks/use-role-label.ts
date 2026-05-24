"use client";

import { useTranslations } from "next-intl";
import type { UserRole } from "@/lib/types";

export function useRoleLabel() {
  const t = useTranslations("roles");
  return (role: UserRole) => {
    switch (role) {
      case "super_admin":
        return t("superAdmin");
      case "admin":
        return t("admin");
      case "manager":
        return t("manager");
      case "agent":
        return t("taskforce");
      default:
        return role;
    }
  };
}
