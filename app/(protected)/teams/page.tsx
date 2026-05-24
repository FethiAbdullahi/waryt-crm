import { TeamsPageClient } from "@/components/teams/teams-page-client";
import { getProtectedSession } from "@/lib/supabase/protected-session";

export default async function TeamsPage() {
  const { profile } = await getProtectedSession();
  return <TeamsPageClient profile={profile} />;
}
