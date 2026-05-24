"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";

const LOCALE_COOKIE = "NEXT_LOCALE";

export function LanguageSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("shell");

  function setLocale(next: AppLocale) {
    if (!routing.locales.includes(next)) return;
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax`;
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "icon" }), "rounded-xl", className)}
        aria-label={t("language")}
      >
        <Languages className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuItem onClick={() => setLocale("en")} className={locale === "en" ? "font-semibold" : ""}>
          {t("langEnglish")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale("am")} className={locale === "am" ? "font-semibold" : ""}>
          {t("langAmharic")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale("om")} className={locale === "om" ? "font-semibold" : ""}>
          {t("langOromo")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
