import { memo } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  /** Upper limit (e.g. stock); + is disabled at the limit */
  max: number;
  /** Lowest allowed value (e.g. 1 so a bill line never drops to 0) */
  min?: number;
  onChange: (value: number) => void;
  /** Accessible name, e.g. "Strips of Dolo 650" */
  label: string;
  /** Small caption on the left, e.g. "STP" */
  unitLabel?: string;
  disabled?: boolean;
};

/** − [n] + control. Typing is clamped to 0…max, so it can never exceed stock. */
export const QtyStepper = memo(function QtyStepper({
  value,
  max,
  min = 0,
  onChange,
  label,
  unitLabel,
  disabled,
}: Props) {
  const set = (n: number) =>
    onChange(Math.max(min, Math.min(max, Math.trunc(n))));
  return (
    <div className="flex items-center gap-1">
      {unitLabel ? (
        <span className="text-[9px] text-muted-foreground w-7 shrink-0">
          {unitLabel}
        </span>
      ) : null}
      <button
        type="button"
        disabled={disabled || value <= min}
        title={
          value <= min && min > 0
            ? "Minimum reached — use Delete to remove the line"
            : undefined
        }
        onClick={() => set(value - 1)}
        aria-label={`Decrease ${label}`}
        className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40"
      >
        <Minus className="h-3 w-3" />
      </button>
      <input
        value={value}
        disabled={disabled}
        inputMode="numeric"
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 5);
          set(digits === "" ? min : Number(digits));
        }}
        className={cn(
          "h-6 w-9 rounded border border-border/60 bg-background text-center text-[11px] tabular-nums font-medium",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      />
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={() => set(value + 1)}
        aria-label={`Increase ${label}`}
        title={value >= max ? `Only ${max} available` : undefined}
        className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
});
