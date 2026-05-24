import { create } from "zustand";

export type SatisfactionPrompt = {
  customerName: string;
  prospectId?: string;
  saleId?: string;
};

type SatisfactionStore = {
  prompt: SatisfactionPrompt | null;
  openPrompt: (p: SatisfactionPrompt) => void;
  clearPrompt: () => void;
};

export const useSatisfactionStore = create<SatisfactionStore>((set) => ({
  prompt: null,
  openPrompt: (p) => set({ prompt: p }),
  clearPrompt: () => set({ prompt: null }),
}));
