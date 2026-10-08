import type { DrugSchedule } from "@medicare/domain/medicines/schedule";
import { SCHEDULE_LABELS } from "@medicare/domain/medicines/schedule";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

/** Small "Rx" / "H1" / "X" mark next to a medicine name (nothing for OTC) */
export function ScheduleBadge({
  schedule,
  className,
}: {
  schedule?: DrugSchedule;
  className?: string;
}) {
  if (!schedule) return null;
  const strict = schedule === "H1" || schedule === "X";
  return (
    <span
      title={tr(SCHEDULE_LABELS[schedule])}
      className={cn(
        "inline-flex items-center rounded px-1 text-[9px] font-bold leading-4 align-middle",
        strict
          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        className,
      )}
    >
      {schedule === "H" ? "Rx" : schedule}
    </span>
  );
}
