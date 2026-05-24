"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Matches `AppThemeProvider` `storageKey` — best-effort cookie sync for persistence across reloads. */
const THEME_COOKIE = "theme";

function readResolved(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribe(onStoreChange: () => void) {
  const el = document.documentElement;
  const obs = new MutationObserver(onStoreChange);
  obs.observe(el, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

/**
 * Theme for shell controls without requiring `useTheme` from `@wrksz/themes` (avoids duplicate-bundle
 * "useTheme must be used within a ThemeProvider" runtime errors). Toggles the same `class="dark"` on
 * `<html>` that `ClientThemeProvider` uses with `attribute="class"`.
 */
export function useShellTheme() {
  const resolvedTheme = useSyncExternalStore(subscribe, readResolved, () => "light");

  const setTheme = useCallback((next: "light" | "dark") => {
    const root = document.documentElement;
    if (next === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      const maxAge = 60 * 60 * 24 * 400;
      document.cookie = `${THEME_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return { resolvedTheme, setTheme, toggleTheme };
}
