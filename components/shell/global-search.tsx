"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useDebouncedValue } from "@/hooks/use-debounce";

const supabase = createBrowserSupabaseClient();

type SearchHit = {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
};

export function GlobalSearch() {
  const t = useTranslations("shell");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 250);

  useEffect(() => {
    const fn = () => setOpen(true);
    window.addEventListener("waryt:open-search", fn as EventListener);
    return () => window.removeEventListener("waryt:open-search", fn as EventListener);
  }, []);

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["search", debounced],
    enabled: open && debounced.trim().length > 1,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_crm", {
        q: debounced,
        p_limit: 20,
      });
      if (error) throw error;
      if (!data) return [];
      if (Array.isArray(data)) return data as SearchHit[];
      if (typeof data === "string") {
        try {
          const parsed = JSON.parse(data) as unknown;
          return Array.isArray(parsed) ? (parsed as SearchHit[]) : [];
        } catch {
          return [];
        }
      }
      return [];
    },
  });

  function go(hit: SearchHit) {
    setOpen(false);
    setQ("");
    if (hit.type === "team") router.push("/");
    if (hit.type === "profile") router.push(`/people/${hit.id}`);
    if (hit.type === "sale") router.push(`/sales?tab=log&focus=${hit.id}`);
  }

  return (
    <>
      <Button
        variant="outline"
        className="hidden rounded-xl md:inline-flex"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 size-4" />
        {t("searchButton")}
        <span className="text-muted-foreground ml-3 hidden text-xs lg:inline">
          {t("searchShortcutHint")}
        </span>
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="rounded-xl md:hidden"
        onClick={() => setOpen(true)}
        aria-label={t("searchAria")}
      >
        <Search className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("searchDialogTitle")}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder={t("searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="text-muted-foreground min-h-24 text-sm">
            {isFetching ? t("searchSearching") : null}
            {!isFetching && debounced.trim().length > 1 && hits.length === 0 ? (
              <p>{t("searchNoMatches")}</p>
            ) : null}
            <ul className="space-y-2">
              {hits.map((h) => (
                <li key={`${h.type}-${h.id}`}>
                  <button
                    type="button"
                    className="hover:bg-muted w-full rounded-xl border px-3 py-2 text-left"
                    onClick={() => go(h)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{h.title}</span>
                      <span className="text-muted-foreground text-xs uppercase">
                        {h.type}
                      </span>
                    </div>
                    {h.subtitle ? (
                      <div className="text-muted-foreground text-xs">{h.subtitle}</div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
