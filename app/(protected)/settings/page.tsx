import { SettingsPageClient } from "@/components/settings/settings-page-client";
import { getProtectedSession } from "@/lib/supabase/protected-session";

type PageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function SettingsPage({ searchParams }: PageProps) {
  const { user, profile } = await getProtectedSession();
  const sp = (await searchParams) ?? {};
  const initialTab = sp.tab === "command" ? "command" : "profile";

  return <SettingsPageClient profile={profile} userId={user.id} initialTab={initialTab} />;
}
