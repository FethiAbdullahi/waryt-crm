"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SalesStudioTabId } from "@/lib/sales-studio/routes";

type SalesStudioNavApi = {
  tab: SalesStudioTabId;
  goTab: (next: SalesStudioTabId) => void;
};

const SalesStudioNavContext = createContext<SalesStudioNavApi | null>(null);

export function SalesStudioNavProvider({
  value,
  children,
}: {
  value: SalesStudioNavApi;
  children: ReactNode;
}) {
  return <SalesStudioNavContext.Provider value={value}>{children}</SalesStudioNavContext.Provider>;
}

export function useSalesStudioNav() {
  const v = useContext(SalesStudioNavContext);
  if (!v) {
    throw new Error("useSalesStudioNav must be used inside SalesStudioWorkspace");
  }
  return v;
}
