"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRoleLabel } from "@/hooks/use-role-label";
import type { Profile, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const supabase = createBrowserSupabaseClient();

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PeopleDirectoryClient() {
  const roleLabel = useRoleLabel();
  const { data: rows = [], isPending, isError } = useQuery({
    queryKey: ["people", "directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,role,avatar_url,created_at")
        .order("display_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pick<Profile, "id" | "display_name" | "role" | "avatar_url" | "created_at">[];
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="People"
        description={
          <>
            Open a teammate for their performance snapshot.{" "}
            <Link href="/teams" className="text-primary font-semibold underline-offset-4 hover:underline">
              Teams
            </Link>{" "}
            is where you create groups and assign members.
          </>
        }
      />

      {isError ? (
        <p className="text-destructive text-sm">Could not load people — check your connection and try again.</p>
      ) : isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-muted/50 h-24 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No profiles found.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <Link key={p.id} href={`/people/${p.id}`} prefetch className="group block">
              <Card
                className={cn(
                  "h-full rounded-2xl border-border/70 transition-all",
                  "hover:border-primary/35 hover:shadow-md",
                )}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar className="size-12 border border-border/60">
                    <AvatarImage src={p.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="text-sm font-semibold">{initials(p.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold tracking-tight">{p.display_name}</p>
                    <Badge variant="secondary" className="mt-1 rounded-md text-[11px] font-medium">
                      {roleLabel(p.role as UserRole)}
                    </Badge>
                  </div>
                  <Users className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
