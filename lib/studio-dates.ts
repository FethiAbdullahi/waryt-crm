/** UTC calendar quarter bounds for analytics (closed_deal_at comparisons). */
export function currentQuarterUtcRange() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const q = Math.floor(m / 3);
  const startM = q * 3;
  const from = new Date(Date.UTC(y, startM, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(y, startM + 3, 0, 23, 59, 59, 999));
  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
  };
}

export const COMMISSION_RATE = 0.1;
export const COMMISSION_MAX_MONTHS = 12;
