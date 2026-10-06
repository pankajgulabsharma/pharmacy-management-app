import { memo } from "react";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
};

function FilterSelectInner<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: Props<T>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      aria-label={ariaLabel}
      className={cn(
        "h-9 w-[150px] shrink-0 rounded-xl !text-[11px] px-2",
        "bg-muted/40 border border-border/50 shadow-none text-foreground",
        "hover:border-border hover:bg-muted/50",
        "focus-visible:outline-none focus-visible:ring-1",
        "focus-visible:ring-ring focus-visible:border-border",
        "focus-visible:bg-background",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Dropdown filter that sits next to SearchInput / FilterChips in toolbars */
export const FilterSelect = memo(FilterSelectInner) as typeof FilterSelectInner;
