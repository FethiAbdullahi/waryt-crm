import { create } from "zustand";
import { persist } from "zustand/middleware";

type UiState = {
  quickAddOpen: boolean;
  lastSaleIndustry: string | null;
  /** Desktop: hide the left nav rail (mobile still uses the sheet menu). */
  sidebarHidden: boolean;
  setQuickAddOpen: (open: boolean) => void;
  setLastSaleIndustry: (industry: string | null) => void;
  setSidebarHidden: (hidden: boolean) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      quickAddOpen: false,
      lastSaleIndustry: null,
      sidebarHidden: false,
      setQuickAddOpen: (open) => set({ quickAddOpen: open }),
      setLastSaleIndustry: (industry) => set({ lastSaleIndustry: industry }),
      setSidebarHidden: (hidden) => set({ sidebarHidden: hidden }),
    }),
    {
      name: "waryt-crm-ui",
      partialize: (s) => ({
        lastSaleIndustry: s.lastSaleIndustry,
        sidebarHidden: s.sidebarHidden,
      }),
    },
  ),
);
