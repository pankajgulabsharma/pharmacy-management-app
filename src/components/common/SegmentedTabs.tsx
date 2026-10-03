import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SegmentedTab<T extends string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
};

type Props<T extends string> = {
  tabs: readonly SegmentedTab<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
};

function SegmentedTabsInner<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5 shrink-0"
    >
      {tabs.map(({ id, label, icon: Icon, count }) => {
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "h-8 px-3 rounded-md text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {label}
            {count !== undefined ? (
              <span
                className={cn(
                  "tabular-nums rounded px-1 text-[10px]",
                  active ? "bg-primary/10 text-primary" : "bg-muted",
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Switch between views of the same page (e.g. Invoices | Returns) */
export const SegmentedTabs = memo(
  SegmentedTabsInner,
) as typeof SegmentedTabsInner;
