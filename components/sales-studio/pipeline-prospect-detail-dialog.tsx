"use client";

import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFormatMoney } from "@/lib/display-currency-store";
import { labelAccountStatus, labelStage } from "@/lib/sales-studio/routes";
import { storedUsdToEntryAmount } from "@/lib/sales-amount-entry";
import type { StudioProspect } from "@/lib/types";

function fmtIsoDate(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim() === "") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9.5rem_1fr] sm:gap-3">
      <div className="text-muted-foreground text-xs font-medium tracking-wide">{label}</div>
      <div className="text-sm break-words">{value}</div>
    </div>
  );
}

export function PipelineProspectDetailDialog({
  prospect,
  onOpenChange,
  onEdit,
  showOwner,
}: {
  prospect: StudioProspect | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (p: StudioProspect) => void;
  showOwner: boolean;
}) {
  const { money, currency } = useFormatMoney();
  const open = prospect != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {prospect ? (
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle className="pr-8">{prospect.business_name}</DialogTitle>
            {prospect.contact_name?.trim() ? (
              <p className="text-muted-foreground pr-8 text-sm">{prospect.contact_name.trim()}</p>
            ) : null}
          </DialogHeader>
          <div className="space-y-3 border-t border-border/60 pt-3">
            <DetailRow label="Contact email" value={prospect.contact_email?.trim() || "—"} />
            <DetailRow label="Phone" value={prospect.contact_phone?.trim() || "—"} />
            <DetailRow label="Sales team" value={prospect.team_name?.trim() || "—"} />
            {showOwner ? (
              <DetailRow
                label="Added by"
                value={
                  prospect.owner_display_name?.trim() ? (
                    prospect.owner_display_name
                  ) : (
                    <span className="font-mono text-xs">{prospect.owner_id}</span>
                  )
                }
              />
            ) : null}
            <DetailRow label="Industry" value={prospect.industry} />
            <DetailRow label="Company size" value={prospect.company_size_band} />
            <DetailRow label="Stage" value={labelStage(prospect.stage)} />
            <DetailRow label="Account status" value={labelAccountStatus(prospect.account_status)} />
            <DetailRow
              label="Won amount"
              value={
                prospect.stage === "won" &&
                prospect.closed_deal_amount != null &&
                Number(prospect.closed_deal_amount) > 0
                  ? money(storedUsdToEntryAmount(Number(prospect.closed_deal_amount), currency))
                  : "—"
              }
            />
            <DetailRow label="Features of interest" value={prospect.interested_modules?.trim() || "—"} />
            <DetailRow label="Pain points" value={prospect.pain_points?.trim() || "—"} />
            <DetailRow label="Closed deal" value={fmtIsoDate(prospect.closed_deal_at)} />
            <DetailRow label="Created" value={fmtIsoDate(prospect.created_at)} />
            <DetailRow label="Updated" value={fmtIsoDate(prospect.updated_at)} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => {
                onEdit(prospect);
                onOpenChange(false);
              }}
            >
              <Pencil className="mr-2 size-4" aria-hidden />
              Edit account
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
