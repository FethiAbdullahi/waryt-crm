import { PeopleDirectoryClient } from "@/components/people/people-directory-client";
import { canAccessManagerRoutes } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { getProtectedSession } from "@/lib/supabase/protected-session";
import { redirect } from "next/navigation";

export default async function PeopleDirectoryPage() {
  const { user, profile } = await getProtectedSession();
  const role = profile.role as UserRole;

  if (!canAccessManagerRoutes(role)) {
    redirect(`/people/${user.id}`);
  }

  return <PeopleDirectoryClient />;
}
