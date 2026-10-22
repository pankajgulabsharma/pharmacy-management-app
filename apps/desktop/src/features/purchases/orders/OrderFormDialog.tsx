import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Sparkles, Trash2 } from "lucide-react";
import {
  lastRates,
  orderValuePaise,
  type PurchaseOrder,
} from "@medicare/domain/purchases/orders";
import { orderList } from "@medicare/domain/reports/stockInsights";
import {
  inrFromPaise,
  paiseToInput,
  parseRupees,
} from "@medicare/domain/lib/money";
import type { MedicineWithStock } from "@medicare/domain/medicines/types";
import { ModalShell } from "@/components/common/ModalShell";
import { DialogCloseButton } from "@/components/common/DialogCloseButton";
import { cellInputClass, fieldClass } from "@/components/common/formStyles";
import { Button } from "@/components/ui/button";
import { useMedicinesWithStock } from "@/features/medicines/hooks/useMedicinesWithStock";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useSupplierStore } from "@/features/suppliers/store/useSupplierStore";
import { useVelocity } from "@/features/reports/hooks/useVelocity";
import { tr, trn } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { MedicinePicker } from "../components/MedicinePicker";
import { usePurchaseStore } from "../store/usePurchaseStore";
import { useOrderStore } from "./useOrderStore";

type Row = {
  medicineId: string;
  name: string;
  brand: string;
  unit: string;
  stock: string;
  qty: string;
  rate: string;
};

/** Sales speed: last 30 days; order enough for 30 days */
const BASIS = 30;
const COVER = 30;

/**
 * New / change order: supplier, medicines and quantities. "Suggest from
 * sales" fills what this supplier usually sends and is running low.
 */
export function OrderFormDialog({
  editing,
  initialSupplierId = "",
  onClose,
  onSaved,
}: {
  editing: PurchaseOrder | null;
  initialSupplierId?: string;
  onClose: () => void;
  onSaved: (o: PurchaseOrder) => void;
}) {
  const titleId = useId();
  const suppliers = useSupplierStore((s) => s.suppliers);
  const purchases = usePurchaseStore((s) => s.purchases);
  const batches = useInventoryStore((s) => s.batches);
  const medicines = useMedicinesWithStock();
  const create = useOrderStore((s) => s.create);
  const update = useOrderStore((s) => s.update);
  const velocity = useVelocity(BASIS);
  const rates = useMemo(() => lastRates(purchases), [purchases]);
  const byId = useMemo(
    () => new Map(medicines.map((m) => [m.id, m])),
    [medicines],
  );

  const rowOf = (m: MedicineWithStock, qty = "", rate?: number): Row => ({
    medicineId: m.id,
    name: m.name,
    brand: m.brand,
    unit: m.unit,
    stock:
      m.unit === "LSE"
        ? `${m.stockLoose} LSE`
        : `${m.stockStrip} ${m.unit}${m.stockLoose ? ` + ${m.stockLoose}` : ""}`,
    qty,
    rate: paiseToInput(rate ?? rates.get(m.id)?.ratePaise ?? 0) || "",
  });

  const [supplierId, setSupplierId] = useState(
    editing?.supplierId ?? initialSupplierId,
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    (editing?.lines ?? []).flatMap((l) => {
      const m = byId.get(l.medicineId);
      return m ? [rowOf(m, String(l.qty), l.ratePaise)] : [];
    }),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const active = suppliers.filter(
    (s) => s.status === "active" || s.id === editing?.supplierId,
  );
  const lines = rows.map((r) => ({
    medicineId: r.medicineId,
    qty: Math.floor(Number(r.qty) || 0),
    ratePaise: parseRupees(r.rate) ?? 0,
  }));
  const value = orderValuePaise(
    lines.map((l) => ({
      ...l,
      id: "",
      medicineName: "",
      brand: "",
      unit: "",
      unitsPerStrip: 1,
      receivedQty: 0,
      gstPercent: byId.get(l.medicineId)?.gstPercent ?? 0,
    })),
  );

  const add = (m: MedicineWithStock, qty = "") => {
    setError("");
    setRows((rs) =>
      rs.some((r) => r.medicineId === m.id) ? rs : [...rs, rowOf(m, qty)],
    );
  };
  const set = (i: number, k: "qty" | "rate", v: string) =>
    setRows((rs) => rs.map((r, n) => (n === i ? { ...r, [k]: v } : r)));

  // What this supplier last sent and is running low now
  const suggest = () => {
    if (!velocity.items) return;
    const r = orderList(medicines, batches, velocity.items, purchases, {
      days: BASIS,
      coverDays: COVER,
    });
    const mine = r.rows.filter((x) => x.lastSupplierId === supplierId);
    let added = 0;
    for (const x of mine) {
      const m = byId.get(x.medicineId);
      if (!m || rows.some((y) => y.medicineId === m.id)) continue;
      add(m, String(x.orderPacks));
      added++;
    }
    if (added)
      toast.success(
        trn(
          added,
          "1 medicine added from sales",
          "{{n}} medicines added from sales",
        ),
      );
    else toast.info(tr("Nothing from this supplier is running low"));
  };

  const save = async () => {
    if (!supplierId) return setError(tr("Choose a supplier"));
    if (!rows.length) return setError(tr("Add at least one medicine"));
    const bad = rows.find((r) => !(Number(r.qty) > 0));
    if (bad)
      return setError(tr("{{what}}: enter a quantity", { what: bad.name }));
    setBusy(true);
    try {
      const input = { supplierId, notes: notes.trim(), lines };
      const o = editing ? await update(editing.id, input) : await create(input);
      toast.success(
        editing
          ? tr("{{no}} saved", { no: o.orderNo })
          : tr("{{no}} made — send it to the supplier", { no: o.orderNo }),
      );
      onSaved(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("Could not save"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div>
            <h2 id={titleId} className="text-sm font-semibold">
              {editing
                ? tr("Change order {{no}}", { no: editing.orderNo })
                : tr("New purchase order")}
            </h2>
            <p className="text-[10.5px] text-muted-foreground">
              {tr(
                "Quantities in packs · rates from the last bill (you can change them)",
              )}
            </p>
          </div>
        </div>
        <DialogCloseButton onClick={onClose} />
      </div>

      <div className="grid shrink-0 gap-2 border-b border-border px-4 py-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-[10.5px] text-muted-foreground">
            {tr("Supplier")}
          </span>
          <select
            data-autofocus
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              setError("");
            }}
            className={cn(fieldClass, "h-8")}
          >
            <option value="">{tr("Choose a supplier")}</option>
            {active.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10.5px] text-muted-foreground">
            {tr("Note (optional)")}
          </span>
          <input
            value={notes}
            maxLength={300}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tr("e.g. Deliver by Saturday")}
            className={cn(fieldClass, "h-8")}
          />
        </label>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!supplierId || !velocity.items}
            onClick={suggest}
            title={tr("Adds what this supplier last sent and is running low")}
            className="h-8 gap-1 text-[11px]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {tr("Suggest from sales")}
          </Button>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3">
        <MedicinePicker medicines={medicines} onPick={(m) => add(m)} />
      </div>

      <div className="min-h-[160px] flex-1 overflow-auto px-4 py-2">
        {rows.length ? (
          <table className="w-full text-[11.5px]">
            <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-1.5 text-left font-medium">
                  {tr("Medicine")}
                </th>
                <th className="w-24 px-2 text-right font-medium">
                  {tr("In stock")}
                </th>
                <th className="w-28 px-2 text-right font-medium">
                  {tr("Order")}
                </th>
                <th className="w-28 px-2 text-right font-medium">
                  {tr("Rate (₹)")}
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.medicineId} className="border-b border-border/60">
                  <td className="py-1.5">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.brand}
                    </p>
                  </td>
                  <td className="px-2 text-right tabular-nums text-muted-foreground">
                    {r.stock}
                  </td>
                  <td className="px-2 text-right">
                    <span className="inline-flex items-center gap-1">
                      <input
                        inputMode="numeric"
                        aria-label={tr("Order quantity of {{what}}", {
                          what: r.name,
                        })}
                        value={r.qty}
                        onChange={(e) =>
                          set(
                            i,
                            "qty",
                            e.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                        className={cn(
                          cellInputClass,
                          "w-16 text-right tabular-nums",
                        )}
                      />
                      <span className="w-7 text-left text-[10px] text-muted-foreground">
                        {r.unit}
                      </span>
                    </span>
                  </td>
                  <td className="px-2 text-right">
                    <input
                      inputMode="decimal"
                      aria-label={tr("Rate of {{what}}", { what: r.name })}
                      value={r.rate}
                      placeholder="—"
                      onChange={(e) =>
                        set(
                          i,
                          "rate",
                          e.target.value.replace(/[^\d.]/g, "").slice(0, 10),
                        )
                      }
                      className={cn(
                        cellInputClass,
                        "w-20 text-right tabular-nums",
                      )}
                    />
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      aria-label={tr("Remove {{what}}", { what: r.name })}
                      onClick={() =>
                        setRows((rs) => rs.filter((_, n) => n !== i))
                      }
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-8 text-center text-[11px] text-muted-foreground">
            {tr(
              "Search a medicine above, or pick a supplier and press “Suggest from sales”.",
            )}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
        <p
          className={cn(
            "text-[11px]",
            error ? "text-rose-600" : "text-muted-foreground",
          )}
        >
          {error ||
            `${trn(rows.length, "1 item", "{{n}} items")}${value ? ` · ${tr("approx. {{amount}} incl. GST", { amount: inrFromPaise(value) })}` : ""}`}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-[11px]"
          >
            {tr("Cancel")}
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void save()}
            className="h-8 text-[11px]"
          >
            {editing ? tr("Save order") : tr("Make order")}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
