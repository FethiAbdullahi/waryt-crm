"use client";

import { format, isValid, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDisplay(isoDate: string) {
  if (!isoDate) return "";
  const d = parseISO(`${isoDate}T12:00:00`);
  return isValid(d) ? format(d, "MMM d, yyyy") : isoDate;
}

/**
 * Native date control with a visible “field” shell. The real `<input type="date">` sits on top
 * (full hit-target, visually transparent) so the OS calendar opens reliably—including inside
 * dialogs/modals where a screen-reader-only input + `<label htmlFor>` often fails on Windows.
 */
export function DatePickerField({
  id,
  label,
  value,
  onChange,
  disabled,
  className,
  placeholder = "Pick a date",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const display = value ? formatDisplay(value) : "";
  const labelId = `${id}-label`;

  return (
    <div className={cn("space-y-2", className)}>
      <div id={labelId} className="text-sm font-medium leading-none">
        {label}
      </div>
      <div
        className={cn(
          "relative min-h-10 w-full rounded-xl border border-input bg-background shadow-sm",
          "has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
        )}
      >
        <div
          className={cn(
            "pointer-events-none flex min-h-10 w-full items-center px-3 py-2 pr-10 text-sm tabular-nums",
            !display && "text-muted-foreground",
          )}
          aria-hidden
        >
          <span className="min-w-0 flex-1 truncate">{display || placeholder}</span>
          <CalendarDays
            className="text-muted-foreground absolute top-1/2 right-3 size-4 shrink-0 -translate-y-1/2"
            aria-hidden
          />
        </div>
        <input
          id={id}
          type="date"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-labelledby={labelId}
          className={cn(
            "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed",
            disabled && "pointer-events-none",
          )}
        />
      </div>
    </div>
  );
}
