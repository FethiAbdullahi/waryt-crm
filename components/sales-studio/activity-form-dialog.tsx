"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { format } from "date-fns";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { STUDIO_ACTIVITY_CHANNELS } from "@/lib/sales-studio/routes";
import type { StudioActivity } from "@/lib/types";
import { studioActivitySchema, type StudioActivityValues } from "@/lib/validators/studio";

const supabase = createBrowserSupabaseClient();

const channelLabel: Record<string, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
};

export function ActivityFormDialog({
  open,
  onOpenChange,
  prospectId,
  businessName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prospectId: string | null;
  businessName: string;
}) {
  const qc = useQueryClient();
  const form = useForm<StudioActivityValues>({
    resolver: zodResolver(studioActivitySchema),
    defaultValues: { prospect_id: prospectId ?? "", channel: "note", body: "" },
  });

  useEffect(() => {
    if (open && prospectId) {
      form.reset({ prospect_id: prospectId, channel: "note", body: "" });
    }
  }, [open, prospectId, form]);

  const { data: recent = [] } = useQuery({
    queryKey: ["studio", "activities", prospectId],
    enabled: open && Boolean(prospectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_activities")
        .select("id,channel,body,created_at")
        .eq("prospect_id", prospectId as string)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as Pick<StudioActivity, "id" | "channel" | "body" | "created_at">[];
    },
  });

  const save = useMutation({
    mutationFn: async (values: StudioActivityValues) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase.from("studio_activities").insert({
        prospect_id: values.prospect_id,
        user_id: uid,
        channel: values.channel,
        body: values.body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["studio", "activities", prospectId] });
      await qc.invalidateQueries({ queryKey: ["studio", "activity-feed"] });
      await qc.invalidateQueries({ queryKey: ["studio", "prospects"] });
      toast.success("Interaction logged");
      form.reset({ prospect_id: prospectId ?? "", channel: "note", body: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!prospectId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,40rem)] overflow-y-auto rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Log interaction · {businessName}</DialogTitle>
          <DialogDescription>
            Saves to this account&apos;s timeline. The same entries appear under{" "}
            <span className="text-foreground font-medium">Waryt Studio → Insights</span> (Pipeline
            touchpoints) and on the <span className="text-foreground font-medium">Sales desk</span> feed
            below your target.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <input type="hidden" {...form.register("prospect_id")} />
          <div className="space-y-2">
            <Label>Channel</Label>
            <Controller
              control={form.control}
              name="channel"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STUDIO_ACTIVITY_CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {channelLabel[c] ?? c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="act-body">What happened?</Label>
            <Textarea id="act-body" rows={4} className="rounded-xl" {...form.register("body")} />
            {form.formState.errors.body ? (
              <p className="text-destructive text-sm">{form.formState.errors.body.message}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="submit" className="rounded-xl" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Log interaction"}
            </Button>
          </DialogFooter>
        </form>
        <div className="border-t pt-4">
          <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
            Recent on this account
          </p>
          {recent.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity yet.</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {recent.map((a) => (
                <li key={a.id} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <div className="text-muted-foreground text-xs">
                    {channelLabel[a.channel] ?? a.channel} · {format(new Date(a.created_at), "MMM d, HH:mm")}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{a.body}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
