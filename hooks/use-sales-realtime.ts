"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export function useSalesRealtime(
  supabase: SupabaseClient,
  opts: { teamIds: string[]; userId: string },
) {
  const queryClient = useQueryClient();
  const timer = useRef<number | null>(null);
  const { teamIds, userId } = opts;

  useEffect(() => {
    const filter =
      teamIds.length === 0
        ? `user_id=eq.${userId}`
        : teamIds.length === 1
          ? `team_id=eq.${teamIds[0]}`
          : `team_id=in.(${teamIds.join(",")})`;

    const channel = supabase
      .channel("sales-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales_entries",
          filter,
        },
        () => {
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            void queryClient.invalidateQueries({ queryKey: ["sales"] });
            void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
            void queryClient.invalidateQueries({ queryKey: ["studio", "performance-quarter-sales"] });
          }, 400);
        },
      )
      .subscribe();

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, supabase, userId, teamIds]);
}
