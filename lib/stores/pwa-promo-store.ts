import { create } from "zustand";
import { persist } from "zustand/middleware";

type PwaPromoState = {
  /** User closed the chip or completed install — hide floating promo. */
  installPromoDismissed: boolean;
  dismissInstallPromo: () => void;
};

export const usePwaPromoStore = create<PwaPromoState>()(
  persist(
    (set) => ({
      installPromoDismissed: false,
      dismissInstallPromo: () => set({ installPromoDismissed: true }),
    }),
    {
      name: "waryt-pwa-install-promo",
      partialize: (s) => ({ installPromoDismissed: s.installPromoDismissed }),
    },
  ),
);
