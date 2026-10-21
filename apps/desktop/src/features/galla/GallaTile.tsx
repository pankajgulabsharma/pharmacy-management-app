import { useNavigate } from "react-router-dom";
import { ChevronRight, Banknote } from "lucide-react";
import { differenceOf } from "@medicare/domain/cash/galla";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { useCan } from "@/features/auth/store/useAuthStore";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DiffBadge } from "./parts";
import { useGallaStatus } from "./useGallaStatus";

/** Dashboard: today's galla in one line — and one click to it */
export function GallaTile() {
  const canSell = useCan("sell");
  const { today } = useGallaStatus();
  const navigate = useNavigate();
  if (!canSell || !today) return null;
  const d = today.day;
  const diff = d ? differenceOf(d) : null;
  return (
    <button
      type="button"
      onClick={() => navigate("/galla")}
      className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/50 hover:shadow-sm"
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          !d
            ? "bg-amber-500/10 text-amber-600"
            : d.status === "open"
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-muted text-muted-foreground",
        )}
      >
        <Banknote className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground">
            {tr("Galla")}
            {today.counter ? ` · ${today.counter}` : ""} ·{" "}
            {tr(
              !d ? "Day not started" : d.status === "open" ? "Open" : "Closed",
            )}
          </span>
          {diff !== null ? <DiffBadge paise={diff} /> : null}
        </span>
        <span className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[15px] font-bold tabular-nums">
            {inrFromPaise(
              d?.status === "closed"
                ? (d.countedPaise ?? 0)
                : today.summary.expectedPaise,
            )}
          </span>
          <span className="truncate text-[10.5px] text-muted-foreground">
            {tr(d?.status === "closed" ? "counted" : "in galla now")}
          </span>
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
    </button>
  );
}
