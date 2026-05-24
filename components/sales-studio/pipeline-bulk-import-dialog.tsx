"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
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
import { STUDIO_INDUSTRY_MAX_LEN } from "@/lib/sales-studio/industry";
import {
  parsePipelineImportWorkbook,
  PIPELINE_IMPORT_TEMPLATE_CSV,
  type PipelineImportInsertRow,
  type PipelineImportIssue,
} from "@/lib/studio/pipeline-import";
import { studioProspectsQueryKey } from "@/lib/sales-studio/query-keys";

const supabase = createBrowserSupabaseClient();

const CHUNK = 40;

function withOwner(rows: PipelineImportInsertRow[], ownerId: string) {
  return rows.map((r) => ({
    ...r,
    owner_id: ownerId,
    team_id: null as null,
  }));
}

export function PipelineBulkImportDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
}) {
  const t = useTranslations("studioPipeline");
  const tToast = useTranslations("toasts.bulkImport");
  const tCommon = useTranslations("common");
  const qc = useQueryClient();
  const [parsed, setParsed] = useState<PipelineImportInsertRow[] | null>(null);
  const [parseIssues, setParseIssues] = useState<PipelineImportIssue[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatIssue = useCallback(
    (it: PipelineImportIssue) => {
      return t(`importIssues.${it.key}`, { ...(it.params ?? {}) } as Record<string, string | number>);
    },
    [t],
  );

  const reset = useCallback(() => {
    setParsed(null);
    setParseIssues([]);
    setFileName(null);
  }, []);

  const importRows = useMutation({
    mutationFn: async (rows: PipelineImportInsertRow[]) => {
      const payloads = withOwner(rows, userId);
      for (let i = 0; i < payloads.length; i += CHUNK) {
        const slice = payloads.slice(i, i + CHUNK);
        const { error } = await supabase.from("studio_prospects").insert(slice);
        if (error) throw error;
      }
    },
    onSuccess: async (_, rows) => {
      await qc.invalidateQueries({ queryKey: studioProspectsQueryKey(userId) });
      toast.success(tToast("imported", { count: rows.length }));
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const { rows, issues } = parsePipelineImportWorkbook(buf);
    setParseIssues(issues);
    setParsed(rows.length ? rows : null);
    if (!rows.length && !issues.length) {
      toast.error(tToast("noRows"));
    } else if (!rows.length && issues.length) {
      toast.error(tToast("fixFile"));
    } else {
      toast.success(tToast("readyTitle", { count: rows.length }), {
        description: issues.length ? tToast("readyWithIssues", { issues: issues.length }) : undefined,
      });
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([PIPELINE_IMPORT_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = t("bulkImportDialog.templateFileName");
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[min(90dvh,36rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("bulkImportDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("bulkImportDialog.description", { maxIndustry: STUDIO_INDUSTRY_MAX_LEN })}
          </DialogDescription>
          <p className="text-muted-foreground text-xs leading-relaxed">{t("bulkImportDialog.templateNote")}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={downloadTemplate}>
              <Download className="mr-2 size-4" />
              {t("bulkImportDialog.downloadTemplate")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 size-4" />
              {t("bulkImportDialog.chooseFile")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = "";
                void onPickFile(f);
              }}
            />
          </div>
          {fileName ? (
            <p className="text-muted-foreground text-sm">
              {t("bulkImportDialog.selectedFile", { fileName })}
            </p>
          ) : null}
          {parsed?.length ? (
            <p className="text-sm">
              {t("bulkImportDialog.rowsReady", { count: parsed.length })}
            </p>
          ) : null}
          {parseIssues.length ? (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
              <p className="text-muted-foreground mb-2 font-medium">{t("bulkImportDialog.issuesHeading")}</p>
              <ul className="list-inside list-disc space-y-1">
                {parseIssues.slice(0, 40).map((it, idx) => (
                  <li key={`${it.rowNumber}-${it.key}-${idx}`}>
                    {it.rowNumber ? t("bulkImportDialog.rowPrefix", { row: it.rowNumber }) : null}{" "}
                    {formatIssue(it)}
                  </li>
                ))}
              </ul>
              {parseIssues.length > 40 ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  {t("bulkImportDialog.moreIssues", { count: parseIssues.length - 40 })}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={!parsed?.length || importRows.isPending}
            onClick={() => parsed && importRows.mutate(parsed)}
          >
            {importRows.isPending ? t("bulkImportDialog.importing") : t("bulkImportDialog.importLeads")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
