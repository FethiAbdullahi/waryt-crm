"use client";

import { CircleHelp } from "lucide-react";
import { useMessages, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { HelpSectionId } from "@/lib/onboarding/copy";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";
import { cn } from "@/lib/utils";

const HELP_IDS: HelpSectionId[] = ["nav", "warytStudio", "quickAdd", "search", "theme"];

export function HelpToolkitPopover({
  triggerClassName,
}: {
  /** e.g. `hidden md:inline-flex` vs `md:hidden` for a second header instance. */
  triggerClassName?: string;
}) {
  const messages = useMessages();
  const tk = useTranslations("onboarding.helpToolkit");
  const resetTips = useOnboardingStore((s) => s.resetTips);
  const help = (messages as { onboarding?: { help?: Record<string, { title: string; body: string }> } })
    .onboarding?.help;

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={tk("triggerAria")}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "rounded-xl",
          triggerClassName,
        )}
      >
        <CircleHelp className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="max-h-[min(70dvh,32rem)] w-[min(22rem,calc(100vw-2rem))] gap-0 overflow-y-auto p-0 sm:w-[24rem]"
      >
        <div className="border-border/60 border-b p-3 sm:p-4">
          <PopoverHeader>
            <PopoverTitle className="text-base">{tk("title")}</PopoverTitle>
            <PopoverDescription className="text-muted-foreground text-xs sm:text-sm">
              {tk("intro")}
            </PopoverDescription>
          </PopoverHeader>
        </div>
        <div className="flex flex-col gap-0 px-1 py-2">
          {HELP_IDS.map((id, i) => {
            const section = help?.[id];
            if (!section) return null;
            return (
              <div key={id}>
                {i > 0 ? <Separator className="my-2" /> : null}
                <div className="px-3 py-2 sm:px-3.5">
                  <h3 className="text-foreground text-sm font-semibold">{section.title}</h3>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-[13px]">
                    {section.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-border/60 flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-8 rounded-lg text-xs"
            onClick={() => resetTips()}
          >
            {tk("resetTips")}
          </Button>
          <p className="text-muted-foreground text-[11px] leading-snug sm:max-w-[12rem] sm:text-left">
            {tk("resetHint")}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
