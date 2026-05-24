import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Profile, UserRole } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export type ProtectedMembership = {
  team_id: string;
  is_primary: boolean;
  member_role: "manager" | "agent";
};

/**
 * Single cached auth + profile + memberships load per request.
 * Use this from `(protected)/layout` and every protected page so navigation
 * does not repeat the same Supabase round-trips.
 */
export const getProtectedSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profileRow, error: profileError }, { data: memberships, error: membersError }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("team_members")
        .select("team_id,is_primary,member_role")
        .eq("user_id", user.id),
    ]);

  if (profileError) throw profileError;
  if (membersError) throw membersError;

  const profile: Profile = profileRow
    ? { ...profileRow, role: profileRow.role as UserRole }
    : {
        id: user.id,
        display_name: user.email ?? "You",
        role: "agent",
        avatar_url: null,
        notification_prefs: {},
        created_at: new Date().toISOString(),
      };

  return {
    supabase,
    user: user as User,
    profile,
    memberships: (memberships ?? []) as ProtectedMembership[],
  };
});
