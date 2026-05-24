"use client";

import { ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePwaInstallStore, type BeforeInstallPromptEvent } from "@/lib/stores/pwa-install-store";
import { usePwaPromoStore } from "@/lib/stores/pwa-promo-store";
import { cn } from "@/lib/utils";

export function PwaInstallFloating({ className }: { className?: string }) {
  const t = useTranslations("shell");
  const standalone = usePwaInstallStore((s) => s.standalone);
  const deferred = usePwaInstallStore((s) => s.deferred);
  const setDeferred = usePwaInstallStore((s) => s.setDeferred);
  const dismissed = usePwaPromoStore((s) => s.installPromoDismissed);
  const dismissPromo = usePwaPromoStore((s) => s.dismissInstallPromo);
  const [showManual, setShowManual] = useState(false);

  if (standalone || dismissed) return null;

  async function onNativeInstall() {
    if (!deferred) {
      setShowManual((v) => !v);
      return;
    }
    const e = deferred as BeforeInstallPromptEvent;
    await e.prompt();
    const { outcome } = await e.userChoice;
    setDeferred(null);
    if (outcome === "accepted") {
      dismissPromo();
      toast.success(t("pwaInstalledToast"));
    }
    setShowManual(false);
  }

  return (
    <div className={cn("flex max-w-[min(100vw-5rem,22rem)] flex-col items-end gap-2", className)}>
      <div
        className={cn(
          "flex w-full max-w-[min(100vw-5rem,20rem)] items-center gap-2 duration-300 animate-in fade-in slide-in-from-bottom-2",
        )}
      >
        <div
          className={cn(
            "border-border/50 from-card/98 to-[color-mix(in_srgb,var(--card)_88%,var(--primary)_12%))] text-foreground relative flex flex-1 items-center gap-2.5 overflow-hidden rounded-2xl border bg-gradient-to-r py-2.5 pl-3 pr-10 shadow-lg backdrop-blur-md",
            "ring-1 ring-[color-mix(in_srgb,var(--primary)_25%,transparent)]",
          )}
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/[0.06] to-transparent"
            aria-hidden
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/warretlogo.png"
            alt=""
            width={28}
            height={28}
            className="relative z-[1] size-7 shrink-0 rounded-lg object-contain shadow-sm"
          />
          <Button
            type="button"
            variant="default"
            size="sm"
            className="relative z-[1] h-9 shrink-0 rounded-xl bg-gradient-to-b from-primary to-[color-mix(in_srgb,var(--primary)_82%,#000)] px-4 text-xs font-bold text-primary-foreground shadow-md"
            onClick={() => void onNativeInstall()}
          >
            {t("pwaInstallShort")}
            {!deferred ? <ChevronDown className="ml-1 size-3.5 opacity-80" aria-hidden /> : null}
          </Button>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="size-10 shrink-0 rounded-xl border border-border/70 bg-card/95 shadow-md backdrop-blur-sm"
          aria-label={t("pwaInstallDismissAria")}
          onClick={() => {
            setShowManual(false);
            dismissPromo();
          }}
        >
          <X className="size-4" />
        </Button>
      </div>

      {showManual && !deferred ? (
        <div
          role="region"
          aria-label={t("pwaManualTitle")}
          className="w-full max-w-[min(100vw-5rem,20rem)] rounded-2xl border border-border/60 bg-card/95 p-4 text-left text-xs leading-relaxed shadow-md backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
        >
          <p className="text-foreground font-semibold">{t("pwaManualTitle")}</p>
          <p className="text-muted-foreground mt-2">{t("pwaManualIntro")}</p>
          <ul className="text-muted-foreground mt-3 list-inside list-disc space-y-1.5">
            <li>{t("pwaManualChrome")}</li>
            <li>{t("pwaManualEdge")}</li>
            <li>{t("pwaManualSafari")}</li>
          </ul>
          <p className="text-muted-foreground mt-3 text-[11px]">{t("pwaManualDevHint")}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3 h-8 w-full rounded-lg text-xs"
            onClick={() => setShowManual(false)}
          >
            {t("pwaManualClose")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
