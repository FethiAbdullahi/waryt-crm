"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Sparkles, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSatisfactionStore } from "@/lib/stores/satisfaction-store";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const supabase = createBrowserSupabaseClient();

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div
      className="flex items-center justify-center gap-2 sm:gap-3"
      role="radiogroup"
      aria-label="Rating"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          className={cn(
            "rounded-full p-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            disabled ? "opacity-50" : "hover:scale-110 active:scale-95",
          )}
          onMouseEnter={() => !disabled && setHover(n)}
          onMouseLeave={() => !disabled && setHover(0)}
          onClick={() => !disabled && onChange(n)}
          aria-label={`${n} stars`}
        >
          <Star
            className={cn(
              "size-10 sm:size-12 transition-colors duration-200",
              n <= active
                ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]"
                : "fill-muted/30 text-muted-foreground/40",
            )}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

export function CustomerSatisfactionDialog({ userId }: { userId: string }) {
  const t = useTranslations("satisfaction");
  const qc = useQueryClient();
  const prompt = useSatisfactionStore((s) => s.prompt);
  const clearPrompt = useSatisfactionStore((s) => s.clearPrompt);
  const [rating, setRating] = useState(0);

  const save = useMutation({
    mutationFn: async () => {
      if (!prompt || rating < 1) return;
      const { error } = await supabase.from("customer_satisfaction_reviews").insert({
        user_id: userId,
        rating,
        customer_name: prompt.customerName.trim() || t("unknownCustomer"),
        prospect_id: prompt.prospectId ?? null,
        sale_id: prompt.saleId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t("toastSaved"));
      setRating(0);
      clearPrompt();
      await qc.invalidateQueries({ queryKey: ["satisfaction"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = prompt != null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setRating(0);
          clearPrompt();
        }
      }}
    >
      <DialogContent className="overflow-hidden border-none p-0 sm:max-w-md">
        <div className="relative bg-gradient-to-br from-primary/95 via-primary to-amber-700/90 px-6 pb-8 pt-10 text-primary-foreground">
          <div
            className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-6 -left-6 size-24 rounded-full bg-amber-300/20 blur-xl"
            aria-hidden
          />
          <DialogHeader className="relative space-y-3 text-center sm:text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Heart className="size-7 fill-white/20 text-white" aria-hidden />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-white">
              {t("title")}
            </DialogTitle>
            <DialogDescription className="text-base text-white/85">
              {t("subtitle", { customer: prompt?.customerName ?? "" })}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 bg-background px-6 py-8">
          <p className="text-muted-foreground text-center text-sm leading-relaxed">{t("prompt")}</p>
          <StarPicker value={rating} onChange={setRating} disabled={save.isPending} />
          {rating > 0 ? (
            <p className="text-center text-sm font-medium text-amber-600 dark:text-amber-400">
              <Sparkles className="mr-1 inline size-4" aria-hidden />
              {t(`ratingLabel.${rating}` as "ratingLabel.1")}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl"
              disabled={save.isPending}
              onClick={() => {
                setRating(0);
                clearPrompt();
              }}
            >
              {t("skip")}
            </Button>
            <Button
              type="button"
              className="rounded-xl px-8 shadow-md"
              disabled={rating < 1 || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? t("saving") : t("submit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
