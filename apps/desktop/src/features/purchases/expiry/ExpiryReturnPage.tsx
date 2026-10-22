import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarX,
  CheckCircle2,
  IndianRupee,
  PackageX,
  Trash2,
  Truck,
} from "lucide-react";
import { inrFromPaise } from "@medicare/domain/lib/money";
import type { ExpiryItem } from "@medicare/domain/purchases/expiryReturns";
import type { PurchaseReturn } from "@medicare/domain/purchases/types";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Segmented } from "@/components/common/Segmented";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/auth/store/useAuthStore";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { tr, trn } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ExpiryBadge } from "./ExpiryBadge";
import { ExpiryItemsPanel, PrintNotesButton } from "./ExpiryItemsPanel";
import { printDebitNote } from "./printDebitNote";
import { useExpiryItems } from "./useExpiryItems";

type Window = "0" | "30" | "60" | "90";
const NO_INVOICE = "__none";

/**
 * Purchases → Expiry return: expired and short-dated stock, supplier by
 * supplier, sent back on debit notes in one go. Stock no invoice explains
 * is listed apart (expired → write off).
 */
export default function ExpiryReturnPage() {
  const navigate = useNavigate();
  const canReturn = useCan("purchases");
  const canWriteOff = useCan("stock");
  const [win, setWin] = useState<Window>("90");
  const { items, groups, noInvoice } = useExpiryItems(Number(win));
  const [picked, setPicked] = useState<string>("");
  const [done, setDone] = useState<PurchaseReturn[] | null>(null);

  const current =
    picked || groups[0]?.supplierId || (noInvoice.length ? NO_INVOICE : "");
  const group = groups.find((g) => g.supplierId === current);

  const stats = useMemo(
    () => ({
      expired: items.filter((i) => i.state === "expired").length,
      credit: groups.reduce((a, g) => a + g.creditPaise, 0),
    }),
    [items, groups],
  );

  return (
    <div className="box-border flex h-full w-full min-h-0 flex-col gap-2.5 overflow-hidden bg-background p-3">
      <PageHeader
        icon={CalendarX}
        title="Expiry return"
        subtitle="Expired and short-dated stock · back to the supplier it came from"
        actions={
          <>
            <Segmented
              label="Expiring within"
              value={win}
              onChange={(v) => {
                setWin(v);
                setPicked("");
              }}
              options={[
                ["0", "Expired only"],
                ["30", "30 days"],
                ["60", "60"],
                ["90", "90"],
              ]}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/purchases")}
              className="h-8 gap-1 text-[11px]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {tr("Purchases")}
            </Button>
          </>
        }
      />

      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          icon={PackageX}
          label="Batches to act on"
          value={String(new Set(items.map((i) => i.batchId)).size)}
          hint={tr("{{n}} expired", { n: stats.expired })}
          iconClass="bg-rose-500/10 text-rose-600"
        />
        <StatCard
          icon={Truck}
          label="Suppliers"
          value={String(groups.length)}
          iconClass="bg-primary/10 text-primary"
        />
        <StatCard
          icon={IndianRupee}
          label="Credit to claim"
          value={inrFromPaise(stats.credit)}
          hint={tr("at invoice rate, incl. GST")}
          iconClass="bg-emerald-500/10 text-emerald-600"
        />
        <StatCard
          icon={CalendarX}
          label="Not on any invoice"
          value={String(noInvoice.length)}
          hint={tr("opening / imported stock")}
          iconClass="bg-amber-500/10 text-amber-600"
        />
      </div>

      {done?.length ? (
        <div className="flex shrink-0 items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <p className="min-w-0 flex-1 truncate text-[12px]">
            {tr("Debit note {{nos}} made for {{who}} · {{amount}}", {
              nos: done.map((r) => r.returnNo).join(", "),
              who: done[0].supplierName,
              amount: inrFromPaise(done.reduce((a, r) => a + r.totalPaise, 0)),
            })}
          </p>
          <PrintNotesButton returns={done} />
          <button
            type="button"
            onClick={() => setDone(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            {tr("Close")}
          </button>
        </div>
      ) : null}

      {!items.length ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-border bg-card">
          <EmptyState
            icon={CheckCircle2}
            title="Nothing expired or short-dated"
            description="Stock expiring in the chosen window shows up here, supplier by supplier."
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-2.5">
          <nav
            aria-label={tr("Suppliers")}
            className="flex w-64 shrink-0 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-card p-1.5 text-foreground"
          >
            {groups.map((g) => (
              <SupplierButton
                key={g.supplierId}
                on={g.supplierId === current}
                name={g.supplierName}
                sub={`${trn(g.items.length, "1 item", "{{n}} items")} · ${trn(g.invoices, "1 invoice", "{{n}} invoices")}`}
                amount={inrFromPaise(g.creditPaise)}
                onClick={() => setPicked(g.supplierId)}
              />
            ))}
            {noInvoice.length ? (
              <SupplierButton
                on={current === NO_INVOICE}
                name={tr("Not on any invoice")}
                sub={`${trn(noInvoice.length, "1 batch", "{{n}} batches")} · ${tr("can't go back on a debit note")}`}
                amount=""
                muted
                onClick={() => setPicked(NO_INVOICE)}
              />
            ) : null}
          </nav>

          {group ? (
            <ExpiryItemsPanel
              key={`${group.supplierId}:${win}`}
              group={group}
              canReturn={canReturn}
              onDone={(rets) => {
                setDone(rets);
                setPicked("");
                printDebitNote(rets);
              }}
            />
          ) : current === NO_INVOICE ? (
            <NoInvoicePanel items={noInvoice} canWriteOff={canWriteOff} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function SupplierButton({
  on,
  name,
  sub,
  amount,
  muted,
  onClick,
}: {
  on: boolean;
  name: string;
  sub: string;
  amount: string;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={on}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
        on ? "bg-primary/10" : "hover:bg-muted",
        muted && !on && "text-muted-foreground",
      )}
    >
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[12px] font-medium",
            on && "text-primary",
          )}
        >
          {name}
        </span>
        <span className="block truncate text-[10.5px] text-muted-foreground">
          {sub}
        </span>
      </span>
      {amount ? (
        <span className="shrink-0 text-[11px] font-semibold tabular-nums">
          {amount}
        </span>
      ) : null}
    </button>
  );
}

/** Stock with no invoice behind it: expired → write it off */
function NoInvoicePanel({
  items,
  canWriteOff,
}: {
  items: ExpiryItem[];
  canWriteOff: boolean;
}) {
  const adjust = useInventoryStore((s) => s.adjust);
  const batches = useInventoryStore((s) => s.batches);
  const [target, setTarget] = useState<ExpiryItem | null>(null);

  const writeOff = async () => {
    const it = target!;
    const b = batches.find((x) => x.id === it.batchId);
    if (!b) return;
    try {
      // Only what no invoice explains leaves stock (the rest can still go back)
      const lse = it.unit === "LSE";
      await adjust(
        b.id,
        {
          qtyStrip: lse ? 0 : Math.max(0, b.qtyStrip - it.packs),
          qtyLoose: lse ? Math.max(0, b.qtyLoose - it.packs) : 0,
        },
        "Expired — written off",
      );
      toast.success(tr("{{what}} written off", { what: it.medicineName }));
      setTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Could not save"));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground">
      <div className="shrink-0 border-b border-border px-3 py-2">
        <p className="text-[12.5px] font-semibold">
          {tr("Not on any invoice")}
        </p>
        <p className="text-[10.5px] text-muted-foreground">
          {tr(
            "Opening or imported stock — no purchase in the app shows who supplied it. Return it by hand, or write off what has expired.",
          )}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-[11.5px]">
          <thead className="sticky top-0 bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur">
            <tr className="border-b border-border">
              <th className="py-2 pl-3 text-left font-medium">
                {tr("Medicine / batch")}
              </th>
              <th className="px-2 text-left font-medium">{tr("Expiry")}</th>
              <th className="px-2 text-right font-medium">{tr("In stock")}</th>
              <th className="pr-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.key} className="border-b border-border/60">
                <td className="py-1.5 pl-3">
                  <p className="font-medium">{i.medicineName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {tr("Batch")} {i.batchNo} · {i.brand}
                  </p>
                </td>
                <td className="px-2">
                  <ExpiryBadge item={i} />
                </td>
                <td className="px-2 text-right tabular-nums">
                  {i.packs} {i.unit}
                  {i.loose ? ` + ${i.loose}` : ""}
                </td>
                <td className="pr-3 text-right">
                  {canWriteOff && i.state === "expired" && i.packs > 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTarget(i)}
                      className="h-7 gap-1 text-[11px] text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {tr("Write off")}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={Boolean(target)}
        title={tr("Write off {{what}}?", { what: target?.medicineName ?? "" })}
        description={tr(
          "{{n}} {{unit}} of batch {{batch}} leave stock as “Expired — written off”. Destroy the strips as per rules.",
          {
            n: target?.packs ?? 0,
            unit: target?.unit ?? "",
            batch: target?.batchNo ?? "",
          },
        )}
        confirmLabel={tr("Write off")}
        onConfirm={() => void writeOff()}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}
