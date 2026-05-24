"use client";

import { useEffect } from "react";
import { usePwaInstallStore } from "@/lib/stores/pwa-install-store";

/** Registers the app service worker with root scope (required for installability). */
export function PwaRegister() {
  const setStandalone = usePwaInstallStore((s) => s.setStandalone);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    function refreshStandalone() {
      const mm = window.matchMedia("(display-mode: standalone)").matches;
      const ios =
        "standalone" in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setStandalone(mm || ios);
    }
    refreshStandalone();
    window.matchMedia("(display-mode: standalone)").addEventListener("change", refreshStandalone);

    let cancelled = false;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        await reg.update();
        await navigator.serviceWorker.ready;
        if (!cancelled) refreshStandalone();
      } catch {
        /* ignore — install may still work from browser menu */
      }
    })();

    return () => {
      cancelled = true;
      window.matchMedia("(display-mode: standalone)").removeEventListener("change", refreshStandalone);
    };
  }, [setStandalone]);

  return null;
}
