import { PeoplePageClient } from "@/components/people/people-page-client";
import { isTaskforceMember } from "@/lib/roles";
import type { Profile, UserRole } from "@/lib/types";
import { getProtectedSession } from "@/lib/supabase/protected-session";
import { redirect } from "next/navigation";

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const { user, profile, supabase } = await getProtectedSession();

  const viewerRole = profile.role as UserRole;

  if (isTaskforceMember(viewerRole) && userId !== user.id) {
    redirect("/");
  }

  const { data: subjectRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!subjectRow) {
    redirect("/");
  }

  const subject: Profile = { ...subjectRow, role: subjectRow.role as UserRole };

  return <PeoplePageClient subject={subject} viewerId={user.id} />;
}
