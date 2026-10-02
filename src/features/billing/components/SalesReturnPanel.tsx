import { useMemo, useState } from "react";
import { ArrowLeft, Minus, PackageMinus, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { savedInvoicesMock, type SavedInvoice } from "../data/mockInvoices";
import type { ReturnLineDraft, ReturnRefundMode } from "../types";
import { calcReturnLineAmount, roundOffToRupee } from "../types";

type Props = {
  onClose: () => void;
};

const REASONS = [
  "Wrong medicine",
  "Excess quantity",
  "Doctor changed",
  "Expired / near expiry",
  "Customer request",
  "Other",
];

const fieldClass = cn(
  "h-8 w-full rounded-lg !text-[11px]",
  "bg-muted/40 border border-border/50 shadow-none",
  "placeholder:!text-[11px] placeholder:text-muted-foreground",
  "hover:border-border hover:bg-muted/50",
  "focus-visible:outline-none focus-visible:ring-1",
  "focus-visible:ring-ring focus-visible:border-border",
  "focus-visible:bg-background",
);

export function SalesReturnPanel({ onClose }: Props) {
  const [query, setQuery] = useState("");
  const [invoice, setInvoice] = useState<SavedInvoice | null>(null);
  const [lines, setLines] = useState<ReturnLineDraft[]>([]);
  const [reason, setReason] = useState(REASONS[0]);
  const [refundMode, setRefundMode] = useState<ReturnRefundMode>("cash");
  const [note, setNote] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return savedInvoicesMock;
    return savedInvoicesMock.filter(
      (inv) =>
        inv.billNo.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q),
    );
  }, [query]);

  const loadInvoice = (inv: SavedInvoice) => {
    setInvoice(inv);
    setLines(
      inv.lines.map((l) => ({
        lineId: l.lineId,
        medicineId: l.medicineId,
        name: l.name,
        batch: l.batch,
        expiry: l.expiry,
        soldStrip: l.qtyStrip,
        soldLoose: l.qtyLoose,
        unitsPerStrip: l.unitsPerStrip,
        salePrice: l.salePrice,
        discountPercent: l.discountPercent,
        returnStrip: l.qtyStrip,
        returnLoose: l.qtyLoose,
      })),
    );
    setSavedMsg("");
  };

  const totals = useMemo(() => {
    const raw = lines.reduce((s, l) => s + calcReturnLineAmount(l), 0);
    const { rounded, roundOff } = roundOffToRupee(raw);
    return { raw, roundOff, total: rounded };
  }, [lines]);

  const hasReturnQty = lines.some(
    (l) => l.returnStrip > 0 || l.returnLoose > 0,
  );

  const setReturnStrip = (lineId: string, v: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        return { ...l, returnStrip: Math.min(Math.max(0, v), l.soldStrip) };
      }),
    );
  };

  const setReturnLoose = (lineId: string, v: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        return { ...l, returnLoose: Math.min(Math.max(0, v), l.soldLoose) };
      }),
    );
  };

  const handleSave = () => {
    if (!invoice || !hasReturnQty) return;
    setSavedMsg(
      `Return saved against ${invoice.billNo} · Refund ₹${totals.total.toFixed(2)} (${refundMode})`,
    );
  };

  return (
    <div className="h-full w-full min-h-0 overflow-hidden grid grid-cols-12 gap-3">
      {/* LEFT — header + search + table */}
      <div className="col-span-12 xl:col-span-9 min-h-0 h-full flex flex-col gap-2.5 overflow-hidden">
        {/* Header — sirf left column mein */}
        <div className="shrink-0 flex items-center gap-2 h-11">
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 shrink-0 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Back to billing"
            title="Back to billing"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="h-8 w-8 shrink-0 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
            <PackageMinus className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground leading-tight">
              Sales Return
            </h2>
            <p className="text-[10px] text-muted-foreground truncate">
              Search invoice → adjust qty → refund
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative shrink-0 p-0.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bill no. or customer..."
            className={cn(fieldClass, "pl-8")}
          />
        </div>

        {!invoice ? (
          <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr>
                  {["Invoice", "Customer", "Date", "Total", ""].map((h) => (
                    <th
                      key={h || "action"}
                      className="px-3 py-2 text-left text-[10px] font-semibold uppercase bg-primary text-primary-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((inv) => (
                  <tr
                    key={inv.billNo}
                    className="border-b border-border/50 hover:bg-primary/5 cursor-pointer bg-card"
                    onClick={() => loadInvoice(inv)}
                  >
                    <td className="px-3 py-2 font-medium">{inv.billNo}</td>
                    <td className="px-3 py-2">{inv.customerName}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {inv.date}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      ₹{inv.total.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-primary text-[10px] font-medium">
                      Select
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 shrink-0 bg-muted/40">
              <div className="text-[11px] min-w-0 truncate">
                <span className="font-semibold">{invoice.billNo}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {invoice.customerName} · {invoice.date}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-7 shrink-0 rounded-lg text-[10px] px-2.5"
                onClick={() => {
                  setInvoice(null);
                  setLines([]);
                  setSavedMsg("");
                }}
              >
                Change Invoice
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {[
                      "Medicine",
                      "Batch",
                      "Sold",
                      "Return STP",
                      "Return LSE",
                      "Amount",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-2.5 py-2 text-left text-[10px] font-semibold uppercase bg-primary text-primary-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr
                      key={l.lineId}
                      className="border-b border-border/50 bg-card"
                    >
                      <td className="px-2.5 py-2">
                        <p className="font-medium">{l.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Sale ₹{l.salePrice}
                          {l.discountPercent > 0
                            ? ` · ${l.discountPercent}% off`
                            : ""}
                        </p>
                      </td>
                      <td className="px-2.5 py-2">
                        <p>{l.batch}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Exp {l.expiry}
                        </p>
                      </td>
                      <td className="px-2.5 py-2 tabular-nums">
                        {l.soldStrip} STP
                        {l.soldLoose > 0 ? ` + ${l.soldLoose} LSE` : ""}
                      </td>
                      <td className="px-2.5 py-2">
                        <QtyCtrl
                          value={l.returnStrip}
                          max={l.soldStrip}
                          onChange={(v) => setReturnStrip(l.lineId, v)}
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <QtyCtrl
                          value={l.returnLoose}
                          max={l.soldLoose}
                          onChange={(v) => setReturnLoose(l.lineId, v)}
                        />
                      </td>
                      <td className="px-2.5 py-2 font-semibold tabular-nums text-primary">
                        ₹{calcReturnLineAmount(l).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT — Return Summary: top se bottom tak full height */}
      <div className="col-span-12 xl:col-span-3 min-h-0 h-full overflow-hidden">
        <div className="h-full bg-card border border-border rounded-lg p-3 flex flex-col overflow-hidden">
          <h3 className="text-[11px] font-semibold mb-2 shrink-0">
            Return Summary
          </h3>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 text-[11px] p-0.5">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={fieldClass}
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">
                Refund mode
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    ["cash", "Cash"],
                    ["upi", "UPI"],
                    ["udhaar_adjust", "Udhaar"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRefundMode(id)}
                    className={cn(
                      "rounded-md border py-1.5 text-[9px] font-medium transition-colors",
                      refundMode === id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">
                Note
              </label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
                className={fieldClass}
              />
            </div>

            <div className="border-t border-border pt-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Return amount</span>
                <span className="tabular-nums">₹{totals.raw.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Round Off</span>
                <span className="tabular-nums">
                  {totals.roundOff >= 0 ? "+" : "−"}₹
                  {Math.abs(totals.roundOff).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-primary">
                <span>Refund</span>
                <span className="tabular-nums">₹{totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="shrink-0 mt-2 space-y-1.5">
            <Button
              type="button"
              disabled={!invoice || !hasReturnQty}
              onClick={handleSave}
              className="w-full h-9 rounded-lg text-[11px]"
            >
              Save Return
              {hasReturnQty ? ` · ₹${totals.total.toFixed(2)}` : ""}
            </Button>
            {savedMsg ? (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                {savedMsg}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function QtyCtrl({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40"
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="w-6 text-center tabular-nums font-medium">{value}</span>
      <button
        type="button"
        className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
