"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  const tCommon = useTranslations("common");
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("somethingWrong")}</h1>
      <p className="text-muted-foreground text-sm">{error.message}</p>
      <Button onClick={() => reset()}>{tCommon("tryAgain")}</Button>
    </div>
  );
}
