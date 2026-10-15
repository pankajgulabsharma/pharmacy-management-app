import { useMemo, useState } from "react";
import { Copy, Download, MessageCircle } from "lucide-react";
import {
  deadStock,
  orderList,
  type OrderRow,
  type DeadStockRow,
  type VelocityWindow,
} from "@medicare/domain/reports/stockInsights";
import { formatPaise, inrFromPaise } from "@medicare/domain/lib/money";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { Segmented } from "@/components/common/Segmented";
import { downloadText, toCsv } from "@/lib/csv";
import { tr } from "@/lib/i18n";
import { useVelocity } from "../hooks/useVelocity";
import { ReportTable } from "./ReportTable";
import { OrderSendDialog } from "./OrderSendDialog";

const medicinesText = (n: number) =>
  n === 1 ? tr("1 medicine") : tr("{{n}} medicines", { n });

/** Rows drawn on screen; Export has them all */
const SHOWN = 100;

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });

const qty = (n: number, unit: string) =>
  `${Number.isInteger(n) ? n : n.toFixed(1)} ${unit}`;

function ActionButton({
  onClick,
  icon: Icon,
  children,
  disabled,
}: {
  onClick: () => void;
  icon: typeof Copy;
  children: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
    >
      <Icon className="h-3.5 w-3.5" />
      {tr(children)}
    </button>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Not selling: money locked on the shelf. Return it to the supplier while
 * it can still be returned, put it on offer, or stop ordering it.
 */
export function DeadStockCard() {
  const [days, setDays] = useState<"60" | "90" | "180">("90");
  const medicines = useMedicineStore((s) => s.medicines);
  const batches = useInventoryStore((s) => s.batches);
  // Last sale date is over all bills, whatever the window
  const v = useVelocity(60);
  const r = useMemo(
    () =>
      v.items ? deadStock(medicines, batches, v.items, Number(days)) : null,
    [medicines, batches, v.items, days],
  );

  const exportCsv = () =>
    r &&
    downloadText(
      `dead-stock_${days}-days.csv`,
      toCsv(r.rows, [
        { header: "Medicine", value: (x: DeadStockRow) => x.name },
        { header: "Company", value: (x) => x.brand },
        { header: "Stock", value: (x) => qty(x.packs, x.unit) },
        {
          header: "Value at cost (Rs)",
          value: (x) => formatPaise(x.costPaise),
        },
        {
          header: "Last sold",
          value: (x) => (x.lastSoldAt ? date(x.lastSoldAt) : "Never"),
        },
        { header: "Nearest expiry", value: (x) => x.nearestExpiry ?? "" },
      ]),
    );

  return (
    <ReportTable
      title="Dead stock — not selling"
      subtitle={
        r
          ? tr("{{what}} · {{amount}} locked · not sold in {{days}} days", {
              what: medicinesText(r.rows.length),
              amount: inrFromPaise(r.costPaise),
              days,
            })
          : v.error
            ? tr(v.error)
            : tr("Loading…")
      }
      rows={r?.rows.slice(0, SHOWN) ?? []}
      getKey={(x) => x.medicineId}
      empty={
        r
          ? "Everything in stock sold in this time — nothing is stuck"
          : "Loading…"
      }
      action={
        <div className="flex flex-wrap items-center gap-1.5">
          <Segmented
            label="Not sold in"
            value={days}
            onChange={setDays}
            options={[
              ["60", "60 days"],
              ["90", "90 days"],
              ["180", "180 days"],
            ]}
          />
          <ActionButton
            icon={Download}
            onClick={exportCsv}
            disabled={!r?.rows.length}
          >
            Export
          </ActionButton>
        </div>
      }
      columns={[
        {
          key: "name",
          label: "Medicine",
          render: (x) => (
            <>
              {x.name}
              <span className="block text-[10px] text-muted-foreground">
                {x.brand}
              </span>
            </>
          ),
        },
        {
          key: "stock",
          label: "Stock",
          width: "w-[90px]",
          render: (x) => qty(x.packs, x.unit),
        },
        {
          key: "cost",
          label: "Locked (₹)",
          align: "right",
          width: "w-[100px]",
          render: (x) => formatPaise(x.costPaise),
        },
        {
          key: "last",
          label: "Last sold",
          width: "w-[120px]",
          render: (x) =>
            x.lastSoldAt ? (
              <>
                {date(x.lastSoldAt)}
                <span className="block text-[10px] text-muted-foreground">
                  {tr("{{n}} days ago", { n: x.idleDays ?? 0 })}
                </span>
              </>
            ) : (
              <span className="text-orange-600">{tr("Never")}</span>
            ),
        },
        {
          key: "exp",
          label: "Expiry",
          width: "w-[70px]",
          render: (x) => x.nearestExpiry ?? "—",
        },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ */

/**
 * What to order now: enough for the next weeks at the current speed of
 * sale, never below the medicine's minimum. Copy → paste in WhatsApp to
 * the distributor.
 */
export function OrderListCard() {
  const [basis, setBasis] = useState<"30" | "60" | "90">("30");
  const [cover, setCover] = useState<"15" | "30" | "45">("30");
  const medicines = useMedicineStore((s) => s.medicines);
  const batches = useInventoryStore((s) => s.batches);
  const purchases = usePurchaseStore((s) => s.purchases);
  const shop = useSettingsStore((s) => s.shop);
  const v = useVelocity(Number(basis) as VelocityWindow);
  const r = useMemo(
    () =>
      v.items
        ? orderList(medicines, batches, v.items, purchases, {
            days: Number(basis),
            coverDays: Number(cover),
          })
        : null,
    [medicines, batches, purchases, v.items, basis, cover],
  );

  // Preview → send to the supplier on WhatsApp, or copy
  const [sending, setSending] = useState(false);
  const exportCsv = () =>
    r &&
    downloadText(
      `order-list_${cover}-days.csv`,
      toCsv(r.rows, [
        { header: "Medicine", value: (x: OrderRow) => x.name },
        { header: "Company", value: (x) => x.brand },
        { header: "Order", value: (x) => `${x.orderPacks} ${x.unit}` },
        { header: "In stock", value: (x) => qty(x.inStockPacks, x.unit) },
        {
          header: `Sold in ${basis} days`,
          value: (x) => qty(x.soldPacks, x.unit),
        },
        { header: "Est. cost (Rs)", value: (x) => formatPaise(x.estCostPaise) },
        { header: "Last supplier", value: (x) => x.lastSupplier },
      ]),
    );

  return (
    <>
      <ReportTable
        title="What to order"
        subtitle={
          r
            ? tr(
                "{{what}} · about {{amount}} · enough for {{cover}} days at the speed of the last {{basis}} days",
                {
                  what: medicinesText(r.rows.length),
                  amount: inrFromPaise(r.estCostPaise),
                  cover,
                  basis,
                },
              )
            : v.error
              ? tr(v.error)
              : tr("Loading…")
        }
        rows={r?.rows.slice(0, SHOWN) ?? []}
        getKey={(x) => x.medicineId}
        empty={r ? "Enough stock of everything — nothing to order" : "Loading…"}
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            <Segmented
              label="Sales of the last"
              value={basis}
              onChange={setBasis}
              options={[
                ["30", "Last 30 days"],
                ["60", "60"],
                ["90", "90"],
              ]}
            />
            <Segmented
              label="Enough for"
              value={cover}
              onChange={setCover}
              options={[
                ["15", "For 15 days"],
                ["30", "30"],
                ["45", "45"],
              ]}
            />
            <ActionButton
              icon={MessageCircle}
              onClick={() => setSending(true)}
              disabled={!r?.rows.length}
            >
              Send on WhatsApp
            </ActionButton>
            <ActionButton
              icon={Download}
              onClick={exportCsv}
              disabled={!r?.rows.length}
            >
              Export
            </ActionButton>
          </div>
        }
        columns={[
          {
            key: "name",
            label: "Medicine",
            render: (x) => (
              <>
                {x.name}
                <span className="block text-[10px] text-muted-foreground">
                  {x.lastSupplier || x.brand}
                </span>
              </>
            ),
          },
          {
            key: "order",
            label: "Order",
            width: "w-[90px]",
            render: (x) => (
              <b className="text-primary tabular-nums">
                {x.orderPacks} {x.unit}
              </b>
            ),
          },
          {
            key: "stock",
            label: "In stock",
            width: "w-[110px]",
            render: (x) => (
              <>
                {qty(x.inStockPacks, x.unit)}
                <span className="block text-[10px] text-muted-foreground">
                  {x.daysLeft === null
                    ? tr("below minimum")
                    : x.daysLeft === 0
                      ? tr("runs out today")
                      : tr("~{{n}} days left", { n: x.daysLeft })}
                </span>
              </>
            ),
          },
          {
            key: "sold",
            label: "Sold",
            width: "w-[100px]",
            render: (x) => (
              <>
                {qty(x.soldPacks, x.unit)}
                <span className="block text-[10px] text-muted-foreground">
                  {tr("{{n}} a day", { n: x.perDay })}
                </span>
              </>
            ),
          },
          {
            key: "cost",
            label: "Est. cost (₹)",
            align: "right",
            width: "w-[100px]",
            render: (x) => (x.estCostPaise ? formatPaise(x.estCostPaise) : "—"),
          },
        ]}
      />
      {sending && r ? (
        <OrderSendDialog
          rows={r.rows}
          shop={shop}
          onClose={() => setSending(false)}
        />
      ) : null}
    </>
  );
}
