import { AppShell } from "@/components/shell/app-shell";
import { getProtectedSession } from "@/lib/supabase/protected-session";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, memberships } = await getProtectedSession();

  return (
    <AppShell user={user} profile={profile} memberships={memberships}>
      {children}
    </AppShell>
  );
}
