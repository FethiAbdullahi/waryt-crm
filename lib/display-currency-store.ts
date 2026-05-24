"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";
import { create } from "zustand";
import { formatCompactCurrency, formatCurrency, type DisplayCurrencyCode } from "@/lib/format";
import type { Profile } from "@/lib/types";

export function parseDisplayCurrencyFromProfile(_profile: Profile | null): DisplayCurrencyCode {
  return "ETB";
}

type Store = {
  currency: DisplayCurrencyCode;
  setCurrency: (c: DisplayCurrencyCode) => void;
};

export const useDisplayCurrencyStore = create<Store>((set) => ({
  currency: "ETB",
  setCurrency: () => set({ currency: "ETB" }),
}));

export function useFormatMoney() {
  const locale = useLocale();
  const currency = useDisplayCurrencyStore((s) => s.currency);
  return useMemo(
    () => ({
      currency,
      money: (n: number) => formatCurrency(n, currency, locale),
      compactMoney: (n: number) => formatCompactCurrency(n, currency, locale),
    }),
    [currency, locale],
  );
}
