import { memo } from "react";
import { cn } from "@/lib/utils";
import { useTr } from "@/hooks/useTr";

export type FilterChipOption<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

type Props<T extends string> = {
  options: readonly FilterChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** false = always one line (use where the row has room for it) */
  wrap?: boolean;
};

function FilterChipsInner<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  wrap = true,
}: Props<T>) {
  const tr = useTr();
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-1 shrink-0",
        wrap ? "flex-wrap justify-end" : "flex-nowrap",
      )}
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "h-9 px-3 rounded-lg text-[10px] font-medium border transition-colors whitespace-nowrap",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {tr(o.label)}
            {o.count !== undefined ? (
              <span
                className={cn(
                  "ml-1.5 tabular-nums",
                  active ? "opacity-80" : "text-muted-foreground/80",
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Status filter buttons (generic over the filter id type) */
export const FilterChips = memo(FilterChipsInner) as typeof FilterChipsInner;
