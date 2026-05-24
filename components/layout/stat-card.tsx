import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-elevated group flex flex-col gap-3 p-5 transition-[box-shadow,transform] duration-200 ease-out motion-reduce:transition-none hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </span>
        {Icon ? (
          <Icon
            className="text-muted-foreground size-4 opacity-70 transition-opacity duration-200 group-hover:opacity-100"
            aria-hidden
          />
        ) : null}
      </div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight md:text-[1.65rem]">
        {value}
      </div>
      {hint ? (
        <p className="text-muted-foreground text-xs leading-snug">{hint}</p>
      ) : null}
    </div>
  );
}
