"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { formatCompactNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const supabase = createBrowserSupabaseClient();

export function NotificationsMenu({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });

  const unread = items.filter((n) => !n.read_at).length;

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "relative rounded-xl",
        )}
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="bg-chart-1 text-neutral-950 absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
            {formatCompactNumber(unread)}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-80 pr-2">
          {items.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-sm">You are all caught up.</p>
          ) : (
            items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex cursor-pointer flex-col items-start gap-1 whitespace-normal"
                onClick={() => {
                  if (!n.read_at) markRead.mutate(n.id);
                }}
              >
                <span className="font-medium">{n.title}</span>
                {n.body ? (
                  <span className="text-muted-foreground text-xs">{n.body}</span>
                ) : null}
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
