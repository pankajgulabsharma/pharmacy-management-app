import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTr } from "@/hooks/useTr";

type Props = {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  /** Text length so far + the limit → "12 / 60" beside the label */
  count?: { value: string; max: number };
  className?: string;
  children: ReactNode;
};

/** Label + control + error/hint, with consistent spacing across all dialogs */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  count,
  className,
  children,
}: Props) {
  const tr = useTr();
  return (
    <div className={cn("space-y-1 min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="block truncate text-[11px] font-medium text-foreground"
        >
          {tr(label)}
        </label>
        {count ? <CharCount value={count.value} max={count.max} /> : null}
      </div>
      <div className="p-0.5">{children}</div>
      {error ? (
        <p className="text-[10px] text-red-500 px-0.5" role="alert">
          {tr(error)}
        </p>
      ) : hint ? (
        <p className="text-[10px] text-muted-foreground px-0.5 truncate">
          {tr(hint)}
        </p>
      ) : null}
    </div>
  );
}

/** "12 / 60" — turns orange near the limit, red at it */
export function CharCount({ value, max }: { value: string; max: number }) {
  const n = value.length;
  return (
    <span
      aria-live="polite"
      className={cn(
        "shrink-0 text-[10px] tabular-nums",
        n >= max
          ? "text-red-500"
          : n >= max * 0.85
            ? "text-orange-600"
            : "text-muted-foreground",
      )}
    >
      {n} / {max}
    </span>
  );
}
