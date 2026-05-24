import { ReportsPageClient } from "@/components/reports/reports-page-client";
import { canAccessReports } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { getProtectedSession } from "@/lib/supabase/protected-session";
import { redirect } from "next/navigation";

export default async function ReportsPage() {
  const { profile } = await getProtectedSession();

  const role = profile.role as UserRole;
  if (!canAccessReports(role)) redirect("/");

  return <ReportsPageClient profile={profile} />;
}
