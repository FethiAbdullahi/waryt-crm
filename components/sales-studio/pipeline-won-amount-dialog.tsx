"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entryAmountToStoredEtb, storedEtbToDisplayAmount } from "@/lib/sales-amount-entry";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessName: string;
  /** Stored ETB amount if already won (edit path). */
  initialStoredUsd: number | null;
  isPending: boolean;
  onConfirm: (payload: { closed_deal_amount_stored_usd: number | null }) => void;
};

export function PipelineWonAmountDialog({
  open,
  onOpenChange,
  businessName,
  initialStoredUsd,
  isPending,
  onConfirm,
}: Props) {
  const [amountStr, setAmountStr] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const entry =
        initialStoredUsd != null && Number.isFinite(Number(initialStoredUsd))
          ? storedEtbToDisplayAmount(Number(initialStoredUsd))
          : 0;
      setAmountStr(entry > 0 ? String(entry) : "");
    }
  }

  const submit = () => {
    const raw = amountStr.trim();
    if (!raw) {
      onConfirm({ closed_deal_amount_stored_usd: null });
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    const stored = entryAmountToStoredEtb(n);
    onConfirm({ closed_deal_amount_stored_usd: stored > 0 ? stored : null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as won</DialogTitle>
          <DialogDescription>
            Optional deal amount for <span className="text-foreground font-medium">{businessName}</span>. Leave
            blank if you do not have a figure yet — you can add it later from Prospects.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="won-amt">Deal amount (ETB, optional)</Label>
            <Input
              id="won-amt"
              type="number"
              min={0}
              step="0.01"
              className="rounded-xl"
              placeholder="e.g. 120000"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-xl" disabled={isPending} onClick={submit}>
            {isPending ? "Saving..." : "Save as won"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
