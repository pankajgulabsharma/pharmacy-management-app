import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileMinus, Printer } from "lucide-react";
import {
  expiryReason,
  type ExpiryItem,
  type SupplierExpiryGroup,
} from "@medicare/domain/purchases/expiryReturns";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { toISODate } from "@medicare/domain/lib/date";
import type { PurchaseReturn } from "@medicare/domain/purchases/types";
import { cellInputClass, fieldClass } from "@/components/common/formStyles";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { tr, trn } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { usePurchaseStore } from "../store/usePurchaseStore";
import { printDebitNote } from "./printDebitNote";
import { ExpiryBadge } from "./ExpiryBadge";

/**
 * One supplier's expired / short-dated stock: tick what goes back (all
 * by default), change a quantity if part of it stays, make the debit
 * notes — one per invoice — and print them for the delivery boy.
 */
export function ExpiryItemsPanel({
  group,
  canReturn,
  onDone,
}: {
  group: SupplierExpiryGroup;
  canReturn: boolean;
  onDone: (returns: PurchaseReturn[]) => void;
}) {
  const create = usePurchaseStore((s) => s.createExpiryReturn);
  // Per row: quantity to send ("" = not going back)
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(group.items.map((i) => [i.key, String(i.packs)])),
  );
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const picked = useMemo(
    () =>
      group.items
        .map((i) => ({ i, q: Math.min(i.packs, Number(qty[i.key]) || 0) }))
        .filter((x) => x.q > 0),
    [group.items, qty],
  );
  const credit = picked.reduce((a, x) => a + x.q * x.i.source!.ratePaise, 0);
  const invoices = new Set(picked.map((x) => x.i.source!.purchaseId)).size;
  const allOn = picked.length === group.items.length;

  const setAll = (on: boolean) =>
    setQty(
      Object.fromEntries(
        group.items.map((i) => [i.key, on ? String(i.packs) : ""]),
      ),
    );

  const go = async () => {
    setBusy(true);
    try {
      const rets = await create({
        supplierId: group.supplierId,
        date: toISODate(new Date()),
        reason: expiryReason(picked.map((x) => x.i)),
        notes: note.trim(),
        items: picked.map((x) => ({
          purchaseId: x.i.source!.purchaseId,
          purchaseLineId: x.i.source!.purchaseLineId,
          qty: x.q,
        })),
      });
      setConfirm(false);
      toast.success(
        tr("{{nos}} made · {{amount}} credit from {{who}}", {
          nos: rets.map((r) => r.returnNo).join(", "),
          amount: inrFromPaise(rets.reduce((a, r) => a + r.totalPaise, 0)),
          who: group.supplierName,
        }),
      );
      onDone(rets);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Could not save"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-semibold">
            {group.supplierName}
          </p>
          <p className="text-[10.5px] text-muted-foreground">
            {trn(group.items.length, "1 item", "{{n}} items")} ·{" "}
            {trn(group.invoices, "1 invoice", "{{n}} invoices")} ·{" "}
            {tr("up to {{amount}} credit", {
              amount: inrFromPaise(group.creditPaise),
            })}
          </p>
        </div>
        {canReturn ? (
          <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={allOn}
              onChange={(e) => setAll(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--primary)]"
            />
            {tr("Return all")}
          </label>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed text-[11.5px]">
          <colgroup>
            <col className="w-8" />
            <col />
            <col className="w-28" />
            <col className="w-36" />
            <col className="w-24" />
            <col className="w-24" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur">
            <tr className="border-b border-border">
              <th />
              <th className="py-2 text-left font-medium">
                {tr("Medicine / batch")}
              </th>
              <th className="px-2 text-left font-medium">{tr("Expiry")}</th>
              <th className="px-2 text-left font-medium">{tr("Invoice")}</th>
              <th className="px-2 text-right font-medium">{tr("Return")}</th>
              <th className="pr-3 text-right font-medium">{tr("Credit")}</th>
            </tr>
          </thead>
          <tbody>
            {group.items.map((i) => (
              <Row
                key={i.key}
                item={i}
                value={qty[i.key] ?? ""}
                editable={canReturn}
                onChange={(v) => setQty((q) => ({ ...q, [i.key]: v }))}
              />
            ))}
          </tbody>
        </table>
      </div>

      {canReturn ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-3 py-2">
          <input
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder={tr("Note for the supplier (optional)")}
            className={cn(fieldClass, "h-8 min-w-[200px] flex-1")}
          />
          <p className="text-[11px] text-muted-foreground">
            {trn(picked.length, "1 item", "{{n}} items")} ·{" "}
            <b className="text-foreground">{inrFromPaise(credit)}</b>
          </p>
          <Button
            size="sm"
            disabled={!picked.length || busy}
            onClick={() => setConfirm(true)}
            className="h-8 gap-1 text-[11px]"
          >
            <FileMinus className="h-3.5 w-3.5" />
            {tr("Make debit notes")}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm}
        tone="default"
        icon={FileMinus}
        title={tr("Return to {{who}}?", { who: group.supplierName })}
        description={`${trn(picked.length, "1 item leaves stock now.", "{{n}} items leave stock now.")} ${trn(invoices, "1 debit note is made for {{amount}}", "{{n}} debit notes are made (one per invoice) for {{amount}}", { amount: inrFromPaise(credit) })} — ${tr("it comes off what you owe this supplier.")}`}
        confirmLabel={tr("Make debit notes")}
        cancelLabel={tr("Not yet")}
        confirmDisabled={busy}
        onConfirm={() => void go()}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}

function Row({
  item: i,
  value,
  editable,
  onChange,
}: {
  item: ExpiryItem;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  const q = Math.min(i.packs, Number(value) || 0);
  const on = q > 0;
  return (
    <tr
      className={cn(
        "border-b border-border/60",
        !on && "text-muted-foreground",
      )}
    >
      <td className="pl-3">
        {editable ? (
          <input
            type="checkbox"
            aria-label={tr("Return {{what}}", { what: i.medicineName })}
            checked={on}
            onChange={(e) => onChange(e.target.checked ? String(i.packs) : "")}
            className="h-3.5 w-3.5 accent-[var(--primary)]"
          />
        ) : null}
      </td>
      <td className="py-1.5 pr-2">
        <p className="truncate font-medium">{i.medicineName}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {tr("Batch")} {i.batchNo} · {i.brand}
          {i.loose
            ? ` · ${tr("{{n}} loose stay (opened strip)", { n: i.loose })}`
            : ""}
        </p>
      </td>
      <td className="px-2">
        <ExpiryBadge item={i} />
      </td>
      <td className="truncate px-2 text-[11px]">
        <span className="font-mono">{i.source!.invoiceNo}</span>
        <span className="block text-[10px] text-muted-foreground">
          {new Date(`${i.source!.invoiceDate}T00:00:00`).toLocaleDateString(
            "en-IN",
            {
              day: "2-digit",
              month: "short",
              year: "2-digit",
            },
          )}
        </span>
      </td>
      <td className="px-2 text-right">
        {editable ? (
          <span className="inline-flex items-center gap-1">
            <input
              inputMode="numeric"
              aria-label={tr("Quantity to return")}
              value={value}
              onChange={(e) =>
                onChange(
                  String(
                    Math.min(
                      i.packs,
                      Number(e.target.value.replace(/\D/g, "")) || 0,
                    ) || "",
                  ),
                )
              }
              className={cn(cellInputClass, "w-12 text-right tabular-nums")}
            />
            <span className="text-[10px] text-muted-foreground">
              /{i.packs} {i.unit}
            </span>
          </span>
        ) : (
          <span className="tabular-nums">
            {i.packs} {i.unit}
          </span>
        )}
      </td>
      <td className="pr-3 text-right tabular-nums">
        {inrFromPaise(q * i.source!.ratePaise)}
      </td>
    </tr>
  );
}

/** "Print again" for the debit notes just made */
export function PrintNotesButton({ returns }: { returns: PurchaseReturn[] }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => printDebitNote(returns)}
      className="h-7 gap-1 text-[11px]"
    >
      <Printer className="h-3.5 w-3.5" />
      {tr("Print debit notes")}
    </Button>
  );
}
