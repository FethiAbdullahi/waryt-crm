type Rel<T> = T | T[] | null | undefined;

function embeddedProspectName(rel: Rel<{ business_name?: string | null }>): string | null {
  if (!rel) return null;
  const o = Array.isArray(rel) ? rel[0] : rel;
  const n = o?.business_name?.trim();
  return n ? n : null;
}

/** Primary label for a sale row: customer override, else linked pipeline business, else fallback. */
export function saleCompanyLine(row: {
  customer_name?: string | null;
  studio_prospects?: unknown;
}): string {
  const cn = row.customer_name?.trim();
  if (cn) return cn;
  const bn = embeddedProspectName(row.studio_prospects as Rel<{ business_name?: string | null }>);
  if (bn) return bn;
  return "Sale";
}
