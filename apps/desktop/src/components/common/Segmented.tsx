import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

/** Small one-of-N switch (e.g. Sold / Returned, 30 / 60 / 90 days) */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
  /** Read out by screen readers */
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label ? tr(label) : undefined}
      className="inline-flex h-8 rounded-lg border border-border p-0.5 bg-muted/50"
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "px-2.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
            value === v
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/70",
          )}
        >
          {tr(text)}
        </button>
      ))}
    </div>
  );
}
