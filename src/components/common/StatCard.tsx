import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  label: string;
  value: string;
  iconClass: string;
  hint?: string;
};

/** Small KPI card used at the top of list pages */
export const StatCard = memo(function StatCard({
  icon: Icon,
  label,
  value,
  iconClass,
  hint,
}: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-2.5 flex items-center gap-2.5 min-w-0">
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
          iconClass,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-bold text-foreground tabular-nums leading-tight truncate">
          {value}
        </p>
        {hint ? (
          <p className="text-[9px] text-muted-foreground truncate">{hint}</p>
        ) : null}
      </div>
    </div>
  );
});
