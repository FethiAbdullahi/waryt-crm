import { ProtectedHubPanels } from "@/components/shell/protected-hub-panels";
import { canAccessReports } from "@/lib/roles";
import type { HubView } from "@/lib/stores/hub-view-store";
import type { UserRole } from "@/lib/types";
import { getProtectedSession } from "@/lib/supabase/protected-session";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<{ app?: string }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const { user, profile } = await getProtectedSession();
  const sp = (await searchParams) ?? {};
  if (sp.app === "challenges") {
    redirect("/sales?tab=field");
  }
  let serverView: HubView = "home";
  if (sp.app === "reports") serverView = "reports";

  if (serverView === "reports" && !canAccessReports(profile.role as UserRole)) {
    redirect("/");
  }

  return <ProtectedHubPanels userId={user.id} profile={profile} serverView={serverView} />;
}
