"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export function useNotificationsRealtime(
  supabase: SupabaseClient,
  userId: string | undefined,
) {
  const queryClient = useQueryClient();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }, 200);
        },
      )
      .subscribe();

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, supabase, userId]);
}
