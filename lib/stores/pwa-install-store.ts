import { create } from "zustand";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaInstallState = {
  deferred: BeforeInstallPromptEvent | null;
  standalone: boolean;
  setDeferred: (e: BeforeInstallPromptEvent | null) => void;
  setStandalone: (v: boolean) => void;
};

export const usePwaInstallStore = create<PwaInstallState>((set) => ({
  deferred: null,
  standalone: false,
  setDeferred: (e) => set({ deferred: e }),
  setStandalone: (v) => set({ standalone: v }),
}));
