"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { labelAccountStatus, labelStage } from "@/lib/sales-studio/routes";
import { useFormatMoney } from "@/lib/display-currency-store";
import { storedUsdToEntryAmount } from "@/lib/sales-amount-entry";
import type { StudioProspect } from "@/lib/types";

const supabase = createBrowserSupabaseClient();

function parseRow(raw: unknown): StudioProspect & { owner_display_name?: string | null } {
  const row = raw as Record<string, unknown>;
  const prof = row.profiles as
    | { display_name?: string | null }
    | { display_name?: string | null }[]
    | null
    | undefined;
  let owner_display_name: string | null = null;
  if (prof && !Array.isArray(prof) && typeof prof === "object") {
    const d = prof.display_name;
    owner_display_name = d != null && String(d).trim() !== "" ? String(d).trim() : null;
  } else if (Array.isArray(prof) && prof[0] && typeof prof[0] === "object") {
    const d = (prof[0] as { display_name?: string | null }).display_name;
    owner_display_name = d != null && String(d).trim() !== "" ? String(d).trim() : null;
  }
  const { profiles, ...rest } = row;
  void profiles;
  return { ...rest, owner_display_name } as StudioProspect & { owner_display_name?: string | null };
}

export function AdminProspectDetailDialog({
  prospectId,
  open,
  onOpenChange,
}: {
  prospectId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { money, currency } = useFormatMoney();

  const { data: row, isLoading } = useQuery({
    queryKey: ["admin", "prospect-detail", prospectId],
    enabled: open && Boolean(prospectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_prospects")
        .select("*, profiles(display_name)")
        .eq("id", prospectId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return parseRow(data);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,40rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pipeline account</DialogTitle>
          <DialogDescription>Full prospect record linked to this sale.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : !row ? (
          <p className="text-muted-foreground text-sm">No pipeline record found for this link.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Business</p>
              <p className="text-foreground text-lg font-semibold">{row.business_name}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">Owner</p>
                <p className="font-medium">{row.owner_display_name ?? row.owner_id.slice(0, 8) + "…"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Stage</p>
                <Badge variant="secondary" className="rounded-full">
                  {labelStage(row.stage)}
                </Badge>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <p>{labelAccountStatus(row.account_status)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Industry</p>
                <p>{row.industry}</p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Contact</p>
              <p>{row.contact_name?.trim() || "—"}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">Email</p>
                <p className="break-all">{row.contact_email?.trim() || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Phone</p>
                <p>{row.contact_phone?.trim() || "—"}</p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Company size</p>
              <p>{row.company_size_band}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Modules / interest</p>
              <p className="text-muted-foreground leading-relaxed">{row.interested_modules?.trim() || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Pain points</p>
              <p className="text-muted-foreground leading-relaxed">{row.pain_points?.trim() || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Pricing notes</p>
              <p className="text-muted-foreground leading-relaxed">{row.pricing_notes?.trim() || "—"}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">Credit base (stored USD)</p>
                <p className="font-medium tabular-nums">{money(storedUsdToEntryAmount(Number(row.mrr_monthly ?? 0), currency))}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Won deal amount</p>
                <p className="font-medium tabular-nums">
                  {row.closed_deal_amount != null && Number(row.closed_deal_amount) > 0
                    ? money(storedUsdToEntryAmount(Number(row.closed_deal_amount), currency))
                    : "—"}
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">Renewal</p>
                <p>{row.renewal_on ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Credit expires</p>
                <p>{row.credit_expires_on ?? "—"}</p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">CS attention</p>
              <p>{row.needs_cs_attention ? "Yes" : "No"}</p>
            </div>
            <div className="text-muted-foreground text-xs">
              Updated {row.updated_at ? new Date(row.updated_at).toLocaleString() : "—"}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
