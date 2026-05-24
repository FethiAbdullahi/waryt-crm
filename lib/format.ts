import { amountInDisplayCurrency, roundEtb } from "@/lib/sales-amount-entry";

export const DISPLAY_CURRENCY_CODES = ["ETB"] as const;
export type DisplayCurrencyCode = (typeof DISPLAY_CURRENCY_CODES)[number];

export function isDisplayCurrencyCode(v: unknown): v is DisplayCurrencyCode {
  return v === "ETB";
}

export function formatCurrency(value: number, currency: DisplayCurrencyCode = "ETB", locale?: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactCurrency(
  value: number,
  currency: DisplayCurrencyCode = "ETB",
  locale?: string,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatCompactNumber(value: number, locale?: string) {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Format an ETB total (e.g. from RPCs / targets). */
export function formatEtbTotal(etbTotal: number, locale?: string): string {
  return formatCurrency(roundEtb(etbTotal), "ETB", locale);
}

/** @deprecated Legacy name — formats ETB totals. */
export function formatUsdTotalInDisplayPreference(
  etbTotal: number,
  _displayCurrency?: DisplayCurrencyCode,
  locale?: string,
): string {
  return formatEtbTotal(etbTotal, locale);
}

/** Format a sale row in ETB. */
export function formatSaleForDisplayPreference(
  value: number,
  _amountCurrency?: unknown,
  _displayCurrency?: DisplayCurrencyCode,
  locale?: string,
) {
  const n = amountInDisplayCurrency(value);
  return formatCurrency(n, "ETB", locale);
}
