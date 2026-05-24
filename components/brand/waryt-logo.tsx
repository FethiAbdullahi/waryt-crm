"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export const WARYT_LOGO_IMAGE_PATH = "/warretlogo.png";
/** Preferred home-hub asset; falls back to `WARYT_LOGO_IMAGE_PATH` on load error if missing in /public. */
export const WARYT_LOGO_HOME_PRIMARY_PATH = "/Warytlogo.png";

const variantClass = {
  auth: "h-14 w-auto max-w-[260px]",
  sidebar: "h-10 w-auto max-w-[200px]",
  sheet: "mx-auto h-11 w-auto max-w-[220px]",
  home: "h-24 w-auto max-w-[min(100%,320px)] md:h-28 md:max-w-[min(100%,380px)] lg:h-32 lg:max-w-[min(100%,420px)]",
} as const;

type WarytLogoProps = {
  variant?: keyof typeof variantClass;
  className?: string;
  priority?: boolean;
  /** Override raster path (default: `WARYT_LOGO_IMAGE_PATH`, or home primary when `variant="home"`). */
  src?: string;
};

/** Waryt brand mark — raster logo from /public for marketing-accurate colors. */
export function WarytLogo({
  variant = "sidebar",
  className,
  priority = false,
  src,
}: WarytLogoProps) {
  const preferred =
    src ?? (variant === "home" ? WARYT_LOGO_HOME_PRIMARY_PATH : WARYT_LOGO_IMAGE_PATH);
  const [imgSrc, setImgSrc] = useState(preferred);
  const [prevPreferred, setPrevPreferred] = useState(preferred);
  if (preferred !== prevPreferred) {
    setPrevPreferred(preferred);
    setImgSrc(preferred);
  }

  return (
    <div className={cn("relative flex items-center justify-start", variantClass[variant], className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc}
        alt="Waryt CRM"
        width={240}
        height={80}
        fetchPriority={priority ? "high" : undefined}
        className={cn(
          "h-full w-auto object-contain dark:brightness-[1.08]",
          variant === "home" ? "object-center md:object-right" : "object-left",
        )}
        onError={() => {
          setImgSrc((cur) => (cur !== WARYT_LOGO_IMAGE_PATH ? WARYT_LOGO_IMAGE_PATH : cur));
        }}
      />
    </div>
  );
}
