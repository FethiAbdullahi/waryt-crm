/** All monetary amounts in Waryt CRM are Ethiopian Birr (ETB). */

export function roundEtb(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100) / 100;
}

/** Sum helper for stats, dashboards, and leaderboards — amounts are ETB. */
export function saleAmountForStats(amount: number, _currency?: string | null): number {
  return roundEtb(amount);
}

/** @deprecated Misnamed legacy export — returns ETB amount. */
export const saleAmountAsUsdForStats = saleAmountForStats;

/** Persist a sale line in ETB. */
export function normalizeSaleEntryAmount(
  amount: number,
  _unit?: unknown,
): { amount: number; currency: "ETB" } {
  return { amount: roundEtb(amount), currency: "ETB" };
}

/** Store a pipeline / target amount in ETB. */
export function entryAmountToStoredEtb(amount: number, _unit?: unknown): number {
  return roundEtb(amount);
}

/** @deprecated Legacy name — amounts are stored in ETB. */
export const entryAmountToStoredUsd = entryAmountToStoredEtb;

/** Read a stored ETB amount (pass-through). */
export function storedEtbToDisplayAmount(storedEtb: number, _unit?: unknown): number {
  return roundEtb(storedEtb);
}

/** @deprecated Legacy name — stored values are ETB. */
export const storedUsdToEntryAmount = storedEtbToDisplayAmount;

/** Display a sale row amount in ETB. */
export function amountInDisplayCurrency(
  amount: number,
  _amountCurrency?: string | null,
  _displayCurrency?: unknown,
): number {
  return roundEtb(amount);
}
