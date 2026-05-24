import { Loader2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function ProtectedLoading() {
  const t = await getTranslations("common");

  return (
    <div className="from-muted/30 via-background to-primary/[0.06] flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-gradient-to-br px-6">
      <div className="border-primary/25 bg-card text-primary flex size-14 items-center justify-center rounded-2xl border shadow-lg shadow-primary/15">
        <Loader2 className="size-7 animate-spin" aria-hidden />
      </div>
      <p className="text-muted-foreground text-sm font-medium tracking-wide">{t("loading")}</p>
    </div>
  );
}
