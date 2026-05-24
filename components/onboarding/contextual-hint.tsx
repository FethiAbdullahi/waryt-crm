"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";
import type { HintId } from "@/lib/onboarding/copy";
import { cn } from "@/lib/utils";

export function ContextualHint({
  hintId,
  className,
}: {
  hintId: HintId;
  className?: string;
}) {
  const t = useTranslations("onboarding");
  const th = useTranslations(`onboarding.hints.${hintId}`);
  const dismissed = useOnboardingStore((s) => s.isHintDismissed(hintId));
  const dismissHint = useOnboardingStore((s) => s.dismissHint);

  if (dismissed) return null;

  return (
    <aside
      role="note"
      aria-label={t("quickTip")}
      className={cn(
        "border-primary/20 bg-primary/5 text-foreground mb-6 rounded-2xl border p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="text-primary text-xs font-semibold uppercase tracking-wide">{t("quickTip")}</p>
          <h2 className="text-base font-semibold tracking-tight sm:text-lg">{th("title")}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed sm:text-[15px]">{th("body")}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            size="sm"
            className="rounded-xl"
            onClick={() => dismissHint(hintId)}
          >
            {t("gotIt")}
          </Button>
        </div>
      </div>
    </aside>
  );
}
