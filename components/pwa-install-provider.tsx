"use client";

import { useEffect } from "react";
import {
  usePwaInstallStore,
  type BeforeInstallPromptEvent,
} from "@/lib/stores/pwa-install-store";
import { usePwaPromoStore } from "@/lib/stores/pwa-promo-store";

/** Captures `beforeinstallprompt` and hides install UI after the app is installed. */
export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const setDeferred = usePwaInstallStore((s) => s.setDeferred);
  const setStandalone = usePwaInstallStore((s) => s.setStandalone);
  const dismissPromo = usePwaPromoStore((s) => s.dismissInstallPromo);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function readStandalone() {
      const mm = window.matchMedia("(display-mode: standalone)").matches;
      const ios =
        "standalone" in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      return mm || ios;
    }
    setStandalone(readStandalone());

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setDeferred(null);
      dismissPromo();
      setStandalone(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    const mq = window.matchMedia("(display-mode: standalone)");
    function onDisplayMode() {
      setStandalone(readStandalone());
    }
    mq.addEventListener("change", onDisplayMode);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
      mq.removeEventListener("change", onDisplayMode);
    };
  }, [setDeferred, setStandalone, dismissPromo]);

  return <>{children}</>;
}
