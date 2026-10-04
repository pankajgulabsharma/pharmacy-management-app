import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { DateInput } from "@/components/common/DateInput";
import {
  FilterChips,
  type FilterChipOption,
} from "@/components/common/FilterChips";
import { fieldClass, invalidFieldClass } from "@/components/common/formStyles";
import { toISODate } from "@/lib/date";
import { PERIOD_LABELS, type PeriodPreset } from "../utils/period";

type Props = {
  preset: PeriodPreset;
  onPresetChange: (p: PeriodPreset) => void;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  invalid: boolean;
};

/**
 * Period chips and, for "Custom", the From/To dates — all on ONE line
 * (the row scrolls sideways on very narrow screens instead of wrapping).
 */
export const PeriodFilter = memo(function PeriodFilter({
  preset,
  onPresetChange,
  from,
  to,
  onFromChange,
  onToChange,
  invalid,
}: Props) {
  const options = useMemo<FilterChipOption<PeriodPreset>[]>(
    () =>
      (Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((id) => ({
        id,
        label: PERIOD_LABELS[id],
      })),
    [],
  );
  const today = toISODate(new Date());
  const dateClass = cn(
    fieldClass,
    "w-[132px] px-2",
    invalid && invalidFieldClass,
  );
  const hint = invalid ? "“From” must be on or before “To”" : undefined;

  return (
    <div className="flex items-center gap-2 min-w-0 overflow-x-auto pb-0.5">
      <FilterChips
        options={options}
        value={preset}
        onChange={onPresetChange}
        ariaLabel="Report period"
        wrap={false}
      />
      {preset === "custom" ? (
        <div className="flex items-center gap-1.5 shrink-0" title={hint}>
          <DateInput
            aria-label="From date"
            aria-invalid={invalid}
            value={from}
            max={today}
            onChange={(e) => onFromChange(e.target.value)}
            className={dateClass}
          />
          <span className="text-[11px] text-muted-foreground">to</span>
          <DateInput
            aria-label="To date"
            aria-invalid={invalid}
            value={to}
            max={today}
            onChange={(e) => onToChange(e.target.value)}
            className={dateClass}
          />
        </div>
      ) : null}
    </div>
  );
});
