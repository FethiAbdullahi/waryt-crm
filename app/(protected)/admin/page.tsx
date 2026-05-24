import { AdminHomeClient } from "@/components/admin/admin-home-client";
import { isOrgAdmin } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { getProtectedSession } from "@/lib/supabase/protected-session";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const { user, profile } = await getProtectedSession();

  const role = profile.role as UserRole;
  if (!isOrgAdmin(role)) redirect("/");

  return <AdminHomeClient profile={profile} userId={user.id} />;
}
