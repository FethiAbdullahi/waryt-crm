import { saleAmountForStats } from "@/lib/sales-amount-entry";

import type { StudioProspect } from "@/lib/types";



export type QuarterSaleSlice = {

  prospect_id: string | null;

  amount: number | string | null | undefined;

  amount_currency?: string | null;

};



/**

 * ETB revenue for the UTC quarter: pipeline closed-won amounts (this quarter’s wins)

 * plus Sales log rows in the same window that are not double-counted against those wins.

 */

export function quarterClosedRevenueEtb(

  wonProspectsThisQuarter: Pick<StudioProspect, "id" | "closed_deal_amount">[],

  quarterSales: QuarterSaleSlice[],

): number {

  const wonIds = new Set(wonProspectsThisQuarter.map((p) => p.id));

  const pipelineVol = wonProspectsThisQuarter.reduce(

    (a, p) => a + Number(p.closed_deal_amount ?? 0),

    0,

  );

  const deskExtra = quarterSales.reduce((a, s) => {

    const pid = s.prospect_id;

    if (pid != null && wonIds.has(pid)) return a;

    const raw = Number(s.amount ?? 0);

    return a + saleAmountForStats(raw, s.amount_currency);

  }, 0);

  return pipelineVol + deskExtra;

}



/** @deprecated Legacy name — returns ETB. */

export const quarterClosedRevenueUsd = quarterClosedRevenueEtb;

