import type { ExpiryItem } from "@medicare/domain/purchases/expiryReturns";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** "08/26 · expired 40 days ago" / "11/26 · 25 days left" */
export function ExpiryBadge({
  item,
}: {
  item: Pick<ExpiryItem, "expiry" | "state" | "daysLeft">;
}) {
  const expired = item.state === "expired";
  return (
    <span className="block leading-tight">
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums",
          expired
            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
        )}
      >
        {item.expiry}
      </span>
      <span className="mt-0.5 block text-[10px] text-muted-foreground">
        {expired
          ? tr("expired")
          : item.daysLeft <= 0
            ? tr("expires this month")
            : tr("{{n}} days left", { n: item.daysLeft })}
      </span>
    </span>
  );
}
