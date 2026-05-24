/** React Query key for `studio_prospects` lists (scoped per signed-in user for cache + invalidation). */
export function studioProspectsQueryKey(userId: string) {
  return ["studio", "prospects", userId] as const;
}

/** Sales log rows in the current UTC quarter window (for Performance tab). */
export function studioPerformanceQuarterSalesKey(
  userId: string,
  fromDate: string,
  toDate: string,
) {
  return ["studio", "performance-quarter-sales", userId, fromDate, toDate] as const;
}

/** Sum of personal `targets` rows whose date range overlaps the UTC quarter window. */
export function studioQuarterTargetOverlapSumKey(userId: string, fromDate: string, toDate: string) {
  return ["studio", "quarter-target-overlap-sum", userId, fromDate, toDate] as const;
}
