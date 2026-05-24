import { AdminOrgSalesClient } from "@/components/admin/admin-org-sales-client";
import { isOrgAdmin } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { getProtectedSession } from "@/lib/supabase/protected-session";
import { redirect } from "next/navigation";

export default async function AdminOrgSalesPage() {
  const { profile } = await getProtectedSession();
  const role = profile.role as UserRole;
  if (!isOrgAdmin(role)) redirect("/");

  return <AdminOrgSalesClient />;
}
