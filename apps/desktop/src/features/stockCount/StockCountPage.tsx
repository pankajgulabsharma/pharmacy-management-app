import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ClipboardCheck, Plus } from "lucide-react";
import { inrFromPaise } from "@medicare/domain/lib/money";
import type { StockCount } from "@medicare/domain/inventory/stockCount";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/auth/store/useAuthStore";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CountView } from "./CountView";
import { racksText } from "./rows";
import { StartCountDialog } from "./StartCountDialog";
import { useStockCountStore } from "./useStockCountStore";

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

const STATUS: Record<StockCount["status"], { label: string; cls: string }> = {
  open: {
    label: "Counting",
    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  posted: {
    label: "Posted",
    cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

/**
 * Inventory → Stock count: physical stock taking rack by rack. The list
 * of counts (one open at a time) and, once one is opened, the count
 * screen itself.
 */
export default function StockCountPage() {
  const navigate = useNavigate();
  const canStart = useCan("stock");
  const current = useStockCountStore((s) => s.current);
  const counts = useStockCountStore((s) => s.counts);
  const loaded = useStockCountStore((s) => s.loaded);
  const loadList = useStockCountStore((s) => s.loadList);
  const openCount = useStockCountStore((s) => s.open);
  const [starting, setStarting] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (!first.current) return;
    first.current = false;
    loadList().catch((e: Error) => toast.error(e.message));
  }, [loadList]);

  if (current) return <CountView />;

  const open = counts.find((c) => c.status === "open");
  const show = (id: string) =>
    openCount(id).catch((e: Error) => toast.error(e.message));

  return (
    <div className="box-border flex h-full w-full min-h-0 flex-col gap-2.5 overflow-hidden bg-background p-3">
      <PageHeader
        icon={ClipboardCheck}
        title="Stock count"
        subtitle="Count the shelves rack by rack · differences go into stock"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/inventory")}
              className="h-8 gap-1 text-[11px]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {tr("Inventory")}
            </Button>
            {canStart && !open ? (
              <Button
                size="sm"
                onClick={() => setStarting(true)}
                className="h-8 gap-1 text-[11px]"
              >
                <Plus className="h-3.5 w-3.5" />
                {tr("Start count")}
              </Button>
            ) : null}
          </>
        }
      />

      {open ? (
        <div className="flex shrink-0 items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2">
          <ClipboardCheck className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 truncate text-[12px]">
            <span className="font-semibold">{open.countNo}</span>{" "}
            {tr("is being counted")} · {tr(racksText(open.racks))} ·{" "}
            <span className="text-muted-foreground">
              {tr("started {{when}} by {{who}}", {
                when: when(open.createdAt),
                who: open.createdBy,
              })}
            </span>
          </p>
          <Button
            size="sm"
            onClick={() => void show(open.id)}
            className="h-7 text-[11px]"
          >
            {tr("Continue counting")}
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card text-foreground">
        {loaded && counts.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No stock counts yet"
            description="Start with one or two racks — count what is on the shelf, and the app corrects its stock."
          />
        ) : (
          <table className="w-full text-[11.5px]">
            <thead className="sticky top-0 z-10 bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur">
              <tr className="border-b border-border text-left">
                <th className="py-2 pl-3 font-medium">{tr("Count")}</th>
                <th className="font-medium">{tr("Racks")}</th>
                <th className="font-medium">{tr("Started")}</th>
                <th className="font-medium">{tr("Status")}</th>
                <th className="text-right font-medium">{tr("Counted")}</th>
                <th className="text-right font-medium">{tr("Short")}</th>
                <th className="text-right font-medium">{tr("Excess")}</th>
                <th className="pr-3 text-right font-medium">{tr("Net")}</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => {
                const s = c.summary;
                const st = STATUS[c.status];
                return (
                  <tr
                    key={c.id}
                    onClick={() => void show(c.id)}
                    className="cursor-pointer border-b border-border/60 hover:bg-muted/40"
                  >
                    <td className="py-2 pl-3 font-medium">
                      {c.countNo}
                      {c.note ? (
                        <span className="block max-w-[180px] truncate text-[10px] font-normal text-muted-foreground">
                          {c.note}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[220px] truncate">
                      {tr(racksText(c.racks))}
                    </td>
                    <td className="text-muted-foreground">
                      {when(c.createdAt)} · {c.createdBy}
                    </td>
                    <td>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          st.cls,
                        )}
                      >
                        {tr(st.label)}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">
                      {s ? `${s.counted}/${s.lines}` : "—"}
                    </td>
                    <td
                      className={cn(
                        "text-right tabular-nums",
                        s?.short
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {s?.short
                        ? `${s.short} · ${inrFromPaise(s.shortValuePaise)}`
                        : "—"}
                    </td>
                    <td
                      className={cn(
                        "text-right tabular-nums",
                        s?.excess
                          ? "text-sky-600 dark:text-sky-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {s?.excess
                        ? `${s.excess} · ${inrFromPaise(s.excessValuePaise)}`
                        : "—"}
                    </td>
                    <td className="pr-3 text-right font-medium tabular-nums">
                      {s
                        ? inrFromPaise(s.excessValuePaise - s.shortValuePaise)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <StartCountDialog open={starting} onClose={() => setStarting(false)} />
    </div>
  );
}
