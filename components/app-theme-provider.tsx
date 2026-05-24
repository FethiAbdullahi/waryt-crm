"use client";

import { ClientThemeProvider } from "@wrksz/themes/client";

function normalizeInitialTheme(
  value: string | undefined,
): "light" | "dark" | "system" | undefined {
  if (value === "light" || value === "dark" || value === "system") return value;
  return undefined;
}

export function AppThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: string | undefined;
}) {
  return (
    <ClientThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storage="cookie"
      storageKey="theme"
      initialTheme={normalizeInitialTheme(initialTheme)}
    >
      {children}
    </ClientThemeProvider>
  );
}
