"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserMinus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/page-header";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRoleLabel } from "@/hooks/use-role-label";
import { isOrgAdmin } from "@/lib/roles";
import type { Profile, UserRole } from "@/lib/types";

const supabase = createBrowserSupabaseClient();

function memberDisplayName(m: {
  user_id: string;
  profiles?: { display_name: string } | { display_name: string }[] | null;
}) {
  const p = m.profiles;
  if (p == null) return m.user_id;
  const row = Array.isArray(p) ? p[0] : p;
  return row?.display_name?.trim() || m.user_id;
}

export function TeamsPageClient({ profile }: { profile: Profile | null }) {
  const tTeams = useTranslations("teamsPage");
  const tToast = useTranslations("toasts.teams");
  const role = (profile?.role ?? "agent") as UserRole;
  const roleLabel = useRoleLabel();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const [memberOpen, setMemberOpen] = useState(false);
  const [memberTeamId, setMemberTeamId] = useState<string | null>(null);
  const [memberUserId, setMemberUserId] = useState<string>("");
  const [memberRole, setMemberRole] = useState<"manager" | "agent">("agent");

  const { data: teams = [], isFetching } = useQuery({
    queryKey: ["teams", "with-members"],
    queryFn: async () => {
      const { data: teamRows, error } = await supabase.from("teams").select("id,name").order("name");
      if (error) throw error;

      const teamsOut = [];
      for (const t of teamRows ?? []) {
        const { data: members, error: mErr } = await supabase
          .from("team_members")
          .select("user_id,member_role,is_primary,profiles(display_name)")
          .eq("team_id", t.id);
        if (mErr) throw mErr;
        teamsOut.push({ ...t, members: members ?? [] });
      }
      return teamsOut;
    },
  });

  const { data: people = [] } = useQuery({
    queryKey: ["profiles", "teams-add-member"],
    enabled: memberOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,role")
        .order("display_name", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const resolvedMemberUserId = useMemo(() => {
    if (!memberUserId) return "";
    if (people.length === 0) return "";
    return people.some((p) => p.id === memberUserId) ? memberUserId : "";
  }, [memberUserId, people]);

  const createTeam = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("teams").insert({ name: newName.trim() });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(tToast("teamCreated"));
      setCreateOpen(false);
      setNewName("");
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMember = useMutation({
    mutationFn: async () => {
      if (!memberTeamId || !resolvedMemberUserId) return;
      const { error } = await supabase.from("team_members").insert({
        team_id: memberTeamId,
        user_id: resolvedMemberUserId,
        member_role: memberRole,
        is_primary: false,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(tToast("memberAdded"));
      setMemberOpen(false);
      setMemberUserId("");
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (payload: { teamId: string; userId: string }) => {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", payload.teamId)
        .eq("user_id", payload.userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(tToast("removedFromTeam"));
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-teams"] });
    },
    onError: (e: unknown) => {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : tTeams("removeFailed");
      toast.error(msg);
    },
  });

  const setPrimary = useMutation({
    mutationFn: async (payload: { teamId: string; userId: string }) => {
      const { data: existing, error: e1 } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", payload.userId)
        .eq("is_primary", true);
      if (e1) throw e1;

      for (const row of existing ?? []) {
        const { error } = await supabase
          .from("team_members")
          .update({ is_primary: false })
          .eq("team_id", row.team_id)
          .eq("user_id", payload.userId);
        if (error) throw error;
      }

      const { error: e2 } = await supabase
        .from("team_members")
        .update({ is_primary: true })
        .eq("team_id", payload.teamId)
        .eq("user_id", payload.userId);
      if (e2) throw e2;
    },
    onSuccess: async () => {
      toast.success(tToast("primaryUpdated"));
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTeam = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.from("teams").delete().eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(tToast("teamDeleted"));
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-teams"] });
      await queryClient.invalidateQueries({ queryKey: ["studio_prospects"] });
      await queryClient.invalidateQueries({ queryKey: ["my_sales_teams"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canManage = isOrgAdmin(role) || role === "manager";
  const canDeleteTeam = isOrgAdmin(role);

  return (
    <div className="relative space-y-8 pb-8">
      <div
        className="pointer-events-none absolute -left-20 -top-10 size-[22rem] rounded-full bg-primary/[0.08] blur-3xl"
        aria-hidden
      />
      <PageHeader
        title={tTeams("title")}
        description={tTeams("description")}
        className="relative"
      >
        {canManage ? (
          <Button className="rounded-xl shadow-md shadow-primary/20" onClick={() => setCreateOpen(true)}>
            {tTeams("newTeam")}
          </Button>
        ) : null}
      </PageHeader>

      {isFetching ? (
        <p className="text-muted-foreground text-sm">{tTeams("loading")}</p>
      ) : (
        <div className="grid gap-4">
          {teams.map((team) => (
            <Card
              key={team.id}
              className="rounded-3xl border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04] shadow-lg shadow-primary/5 ring-1 ring-black/[0.03] dark:ring-white/[0.06]"
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>{team.name}</CardTitle>
                  <CardDescription>{tTeams("members", { count: team.members.length })}</CardDescription>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        setMemberTeamId(team.id);
                        setMemberOpen(true);
                      }}
                    >
                      {tTeams("addMember")}
                    </Button>
                    {canDeleteTeam ? (
                      <Button
                        variant="outline"
                        className="rounded-xl text-destructive hover:bg-destructive/10"
                        disabled={deleteTeam.isPending}
                        onClick={() => {
                          if (!window.confirm(tTeams("deleteTeamConfirm", { name: team.name }))) return;
                          deleteTeam.mutate(team.id);
                        }}
                      >
                        <Trash2 className="mr-1 size-3.5" aria-hidden />
                        {tTeams("deleteTeam")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2">
                {team.members.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{tTeams("noMembers")}</p>
                ) : (
                  team.members.map((m: {
                    user_id: string;
                    member_role: string;
                    is_primary: boolean;
                    profiles?: { display_name: string } | { display_name: string }[] | null;
                  }) => (
                    <div
                      key={`${team.id}-${m.user_id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">{memberDisplayName(m)}</div>
                        <div className="text-muted-foreground text-xs">
                          {m.member_role === "manager" ? tTeams("roleManager") : tTeams("roleAgent")}
                          {m.is_primary ? ` · ${tTeams("primaryBadge")}` : ""}
                        </div>
                      </div>
                      {canManage ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {!m.is_primary ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg"
                              disabled={setPrimary.isPending}
                              onClick={() =>
                                setPrimary.mutate({ teamId: team.id, userId: m.user_id })
                              }
                            >
                              {tTeams("setPrimary")}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10 rounded-lg"
                            disabled={removeMember.isPending}
                            onClick={() => {
                              const name = memberDisplayName(m);
                              if (
                                !window.confirm(
                                  tTeams("removeConfirm", { name, team: team.name }),
                                )
                              ) {
                                return;
                              }
                              removeMember.mutate({ teamId: team.id, userId: m.user_id });
                            }}
                          >
                            <UserMinus className="mr-1 size-3.5" aria-hidden />
                            {tTeams("remove")}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{tTeams("createTeamTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="teamName">{tTeams("teamNameLabel")}</Label>
            <Input
              id="teamName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={tTeams("teamNamePlaceholder")}
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button
              className="rounded-xl"
              disabled={!newName.trim() || createTeam.isPending}
              onClick={() => createTeam.mutate()}
            >
              {createTeam.isPending ? tTeams("creating") : tTeams("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={memberOpen}
        onOpenChange={(next) => {
          setMemberOpen(next);
          if (next) {
            setMemberUserId("");
            setMemberRole("agent");
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{tTeams("addMemberTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{tTeams("personLabel")}</Label>
              <Select
                value={resolvedMemberUserId || undefined}
                onValueChange={(v) => {
                  if (!v) return;
                  setMemberUserId(v);
                }}
              >
                <SelectTrigger className="w-full min-w-0 rounded-xl">
                  <SelectValue placeholder={tTeams("chooseSomeone")}>
                    {(value: string | null) => {
                      if (!value) return tTeams("chooseSomeone");
                      const p = people.find((x) => x.id === value);
                      return p
                        ? `${p.display_name} · ${roleLabel(p.role as UserRole)}`
                        : tTeams("chooseSomeone");
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name} · {roleLabel(p.role as UserRole)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tTeams("roleOnTeam")}</Label>
              <Select
                value={memberRole}
                onValueChange={(v) => {
                  if (!v) return;
                  setMemberRole(v as typeof memberRole);
                }}
              >
                <SelectTrigger className="w-full min-w-0 rounded-xl">
                  <SelectValue placeholder={tTeams("rolePlaceholder")}>
                    {(value: string | null) =>
                      value === "manager"
                        ? tTeams("roleManager")
                        : value === "agent"
                          ? tTeams("roleAgent")
                          : tTeams("rolePlaceholder")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">{tTeams("roleAgent")}</SelectItem>
                  <SelectItem value="manager">{tTeams("roleManager")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <DialogFooter>
              <Button
                className="rounded-xl"
                disabled={!resolvedMemberUserId || addMember.isPending}
                onClick={() => addMember.mutate()}
              >
                {addMember.isPending ? tTeams("saving") : tTeams("add")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
