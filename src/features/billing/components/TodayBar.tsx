import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ChevronUp,
  Clock3,
  IndianRupee,
  Receipt,
  ShoppingCart,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge, type BadgeTone } from "@/components/common/StatusBadge";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { inrFromPaise, inrRounded } from "@/lib/money";
import { isSameDay } from "@/lib/date";
import { useSalesStore } from "../store/useSalesStore";
import type { Sale } from "../types";

type Props = {
  /** Open Sales Return with this bill already picked */
  onReturnBill: (saleId: string) => void;
};

const STATUS: Record<
  "paid" | "udhaar" | "returned",
  { label: string; tone: BadgeTone }
> = {
  paid: { label: "Paid", tone: "success" },
  udhaar: { label: "Udhaar", tone: "danger" },
  returned: { label: "Returned", tone: "caution" },
};
const statusOf = (s: Sale) => (s.returnedPaise > 0 ? "returned" : s.status);

/** % vs yesterday, or null when yesterday had nothing */
const pct = (today: number, yesterday: number) =>
  yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 100) : null;

function ago(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return h < 24
    ? `${h} h ago`
    : new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      });
}

/**
 * Today at a glance, in ONE slim row under the bill — so the bill table
 * keeps as much height as possible. Recent bills open in a pop-up list.
 */
export function TodayBar({ onReturnBill }: Props) {
  const sales = useSalesStore((s) => s.sales);
  const purchases = usePurchaseStore((s) => s.purchases);
  const [listOpen, setListOpen] = useState(false);

  const t = useMemo(() => {
    const now = new Date();
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    let sales0 = 0,
      sales1 = 0,
      bills0 = 0,
      bills1 = 0,
      buy0 = 0,
      buys0 = 0;
    for (const s of sales) {
      const d = new Date(s.createdAt);
      const net = s.totals.netPaise - s.returnedPaise;
      if (isSameDay(d, now)) {
        sales0 += net;
        bills0++;
      } else if (isSameDay(d, y)) {
        sales1 += net;
        bills1++;
      }
    }
    for (const p of purchases) {
      if (
        p.status !== "cancelled" &&
        isSameDay(new Date(`${p.invoiceDate}T00:00:00`), now)
      ) {
        buy0 += p.totals.netPaise;
        buys0++;
      }
    }
    return {
      sales0,
      bills0,
      buy0,
      buys0,
      salesPct: pct(sales0, sales1),
      billsPct: pct(bills0, bills1),
      last: sales[0] ?? null,
      recent: sales.slice(0, 8),
      now: now.getTime(),
    };
  }, [sales, purchases]);

  return (
    <div className="relative shrink-0">
      <div className="h-14 rounded-xl border border-border bg-card flex items-stretch overflow-hidden">
        <Tile
          to="/reports?tab=sales&period=today"
          icon={IndianRupee}
          iconClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          label="Today's sales"
          value={inrRounded(t.sales0)}
          trend={t.salesPct}
        />
        <Tile
          to="/reports?tab=sales&period=today"
          icon={Receipt}
          iconClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          label="Bills today"
          value={String(t.bills0)}
          trend={t.billsPct}
        />
        <Tile
          to="/purchases"
          icon={ShoppingCart}
          iconClass="bg-orange-500/10 text-orange-600 dark:text-orange-400"
          label="Purchases today"
          value={inrRounded(t.buy0)}
          extra={
            <span className="text-[10px] text-muted-foreground">
              {t.buys0} inv.
            </span>
          }
        />
        {t.last ? (
          <div className="hidden lg:flex flex-1 min-w-0 items-center gap-2.5 px-3.5 border-l border-border">
            <IconChip
              icon={Clock3}
              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            />
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                Last bill · {ago(t.last.createdAt, t.now)}
              </p>
              {/* Amount first (never cut); the bill number gives way if space is short */}
              <p className="flex items-baseline gap-1.5 min-w-0 whitespace-nowrap">
                <span className="text-[14px] font-bold tabular-nums shrink-0">
                  {inrRounded(t.last.totals.netPaise)}
                </span>
                <span
                  className="font-mono text-[10.5px] text-muted-foreground truncate"
                  title={t.last.billNo}
                >
                  {t.last.billNo}
                </span>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Recent bills — opens a list upwards */}
        <button
          type="button"
          onClick={() => setListOpen((o) => !o)}
          aria-expanded={listOpen}
          aria-haspopup="dialog"
          className={cn(
            "shrink-0 flex items-center gap-2 px-4 border-l border-border text-[12px] font-medium whitespace-nowrap transition-colors",
            listOpen
              ? "bg-primary text-primary-foreground"
              : "text-primary hover:bg-primary/5",
          )}
        >
          Recent bills
          <span
            className={cn(
              "min-w-5 h-5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums flex items-center justify-center",
              listOpen ? "bg-white/20" : "bg-primary/10",
            )}
          >
            {t.recent.length}
          </span>
          <ChevronUp
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              !listOpen && "rotate-180",
            )}
          />
        </button>
      </div>

      {listOpen ? (
        <RecentBillsPopover
          bills={t.recent}
          now={t.now}
          onClose={() => setListOpen(false)}
          onReturnBill={(id) => {
            setListOpen(false);
            onReturnBill(id);
          }}
        />
      ) : null}
    </div>
  );
}

function IconChip({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className: string;
}) {
  return (
    <span
      className={cn(
        "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

function Tile({
  to,
  icon,
  iconClass,
  label,
  value,
  trend,
  extra,
}: {
  to: string;
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: string;
  trend?: number | null;
  extra?: ReactNode;
}) {
  return (
    <Link
      to={to}
      title={`${label} — open details`}
      className="group flex items-center gap-2.5 px-3.5 border-r border-border last-of-type:border-r-0 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:bg-muted/60 shrink-0"
    >
      <IconChip icon={icon} className={iconClass} />
      <div className="leading-tight">
        <p className="text-[10px] text-muted-foreground whitespace-nowrap">
          {label}
        </p>
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-[14px] font-bold text-foreground tabular-nums">
            {value}
          </span>
          {trend !== undefined && trend !== null ? (
            <span
              className={cn(
                "rounded-md px-1 py-px text-[9.5px] font-semibold tabular-nums",
                trend >= 0
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400",
              )}
              title="vs yesterday"
            >
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
            </span>
          ) : null}
          {extra}
        </div>
      </div>
    </Link>
  );
}

function RecentBillsPopover({
  bills,
  now,
  onClose,
  onReturnBill,
}: {
  bills: Sale[];
  now: number;
  onClose: () => void;
  onReturnBill: (saleId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on Esc or a click outside; focus the list for keyboard users
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node))
        onClose();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label="Recent bills"
      className="absolute right-0 bottom-[calc(100%+8px)] z-30 w-[min(560px,100%)] rounded-xl border border-border bg-popover shadow-2xl outline-none overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div>
          <p className="text-[12px] font-semibold">Recent bills</p>
          <p className="text-[10px] text-muted-foreground">
            Latest {bills.length} · Esc to close
          </p>
        </div>
        <Link
          to="/reports?tab=sales&period=today"
          className="text-[11px] font-medium text-primary hover:underline whitespace-nowrap"
        >
          Sales report →
        </Link>
      </div>
      <ul className="max-h-[320px] overflow-y-auto divide-y divide-border/70">
        {bills.map((s) => {
          const st = STATUS[statusOf(s)];
          return (
            <li
              key={s.id}
              className="flex items-center gap-3 px-4 py-2 hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[12px] whitespace-nowrap">
                  <span className="font-mono font-semibold">{s.billNo}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {ago(s.createdAt, now)}
                  </span>
                </p>
                <p className="text-[10.5px] text-muted-foreground truncate">
                  {s.customerName}
                </p>
              </div>
              <StatusBadge tone={st.tone} size="xs">
                {st.label}
              </StatusBadge>
              <span className="w-20 text-right text-[12px] font-semibold tabular-nums">
                {inrFromPaise(s.totals.netPaise)}
              </span>
              <button
                type="button"
                disabled={s.imported}
                onClick={() => onReturnBill(s.id)}
                title={
                  s.imported
                    ? "Imported history can't be returned"
                    : "Return items from this bill"
                }
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10.5px] font-medium hover:bg-muted disabled:opacity-40"
              >
                <Undo2 className="h-3 w-3" />
                Return
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
