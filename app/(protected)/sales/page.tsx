import { SalesStudioWorkspace } from "@/components/sales-studio/sales-studio-workspace";
import { getProtectedSession } from "@/lib/supabase/protected-session";
import { parseSalesStudioTab } from "@/lib/sales-studio/routes";

type PageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function SalesStudioPage({ searchParams }: PageProps) {
  const { user, profile } = await getProtectedSession();
  const sp = (await searchParams) ?? {};
  const initialTab = parseSalesStudioTab(sp.tab);

  return <SalesStudioWorkspace userId={user.id} profile={profile} initialTab={initialTab} />;
}
