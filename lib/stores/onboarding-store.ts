import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CURRENT_HINTS_VERSION,
  type HintId,
} from "@/lib/onboarding/copy";

type OnboardingState = {
  /** When this is less than `CURRENT_HINTS_VERSION`, contextual hints are shown again. */
  hintsVersion: number;
  dismissed: Partial<Record<HintId, true>>;
  dismissHint: (id: HintId) => void;
  isHintDismissed: (id: HintId) => boolean;
  resetTips: () => void;
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      hintsVersion: CURRENT_HINTS_VERSION,
      dismissed: {},
      dismissHint: (id) =>
        set((s) => ({
          hintsVersion: CURRENT_HINTS_VERSION,
          dismissed: { ...s.dismissed, [id]: true },
        })),
      isHintDismissed: (id) => {
        const s = get();
        if (s.hintsVersion !== CURRENT_HINTS_VERSION) return false;
        return Boolean(s.dismissed[id]);
      },
      resetTips: () =>
        set({
          dismissed: {},
          hintsVersion: CURRENT_HINTS_VERSION,
        }),
    }),
    {
      name: "waryt-crm-onboarding",
      partialize: (s) => ({
        hintsVersion: s.hintsVersion,
        dismissed: s.dismissed,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<
          Pick<OnboardingState, "hintsVersion" | "dismissed">
        >;
        return {
          ...current,
          hintsVersion: typeof p.hintsVersion === "number" ? p.hintsVersion : 0,
          dismissed: p.dismissed ?? {},
        };
      },
    },
  ),
);
