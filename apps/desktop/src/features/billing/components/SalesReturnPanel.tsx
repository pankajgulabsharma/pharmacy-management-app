import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, PackageMinus, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/common/SearchInput";
import { KeyHints } from "@/components/common/KeyHints";
import { useHotkeys } from "@/hooks/useHotkeys";
import { SELECTED_ROW, useListNavigation } from "@/hooks/useListNavigation";
import { KEYS } from "@/app/shortcuts/registry";
import { scrollRowIntoView } from "@/lib/dom";
import { EmptyState } from "@/components/common/EmptyState";
import { CodeChip } from "@/components/common/CodeChip";
import { QtyStepper } from "@/components/common/QtyStepper";
import { BatchExpiry } from "./BatchExpiry";
import { fieldClass } from "@/components/common/formStyles";
import {
  inrFromPaise,
  roundToRupee,
  signedInrFromPaise,
} from "@medicare/domain/lib/money";
import { useSalesStore } from "../store/useSalesStore";
import {
  BILLING_LIMITS,
  REFUND_MODE_LABELS,
  SALE_RETURN_REASONS,
  type RefundMode,
  type Sale,
} from "@medicare/domain/billing/types";
import {
  getReturnableSaleLines,
  returnAmount,
} from "@medicare/domain/billing/saleReturn";

type Props = {
  onClose: () => void;
  /** Open with this bill already picked (from "Recent bills") */
  initialSaleId?: string | null;
};

const MAX_LIST = 50;

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** One format everywhere on this screen: "03 Oct 2026, 11:40 am" */
function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso));
}

function matches(s: Sale, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    s.billNo.toLowerCase().includes(needle) ||
    s.customerName.toLowerCase().includes(needle) ||
    s.lines.some((l) => l.medicineName.toLowerCase().includes(needle))
  );
}

export function SalesReturnPanel({ onClose, initialSaleId = null }: Props) {
  const sales = useSalesStore((s) => s.sales);
  const saleReturns = useSalesStore((s) => s.saleReturns);
  const createSaleReturn = useSalesStore((s) => s.createSaleReturn);

  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query);
  const [saleId, setSaleId] = useState<string | null>(initialSaleId);
  const [qty, setQty] = useState<
    Record<string, { strip: number; loose: number }>
  >({});
  const [reason, setReason] = useState<string>(SALE_RETURN_REASONS[0]);
  const [refundMode, setRefundMode] = useState<RefundMode>("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const list = useMemo(
    () =>
      sales
        .filter((s) => !s.imported && matches(s, deferredQuery))
        .slice(0, MAX_LIST),
    [sales, deferredQuery],
  );
  const sale = saleId ? (sales.find((s) => s.id === saleId) ?? null) : null;

  const rows = useMemo(
    () => (sale ? getReturnableSaleLines(sale, saleReturns) : []),
    [sale, saleReturns],
  );
  const previous = useMemo(
    () => (sale ? saleReturns.filter((r) => r.saleId === sale.id) : []),
    [sale, saleReturns],
  );

  const totals = useMemo(() => {
    let raw = 0;
    let any = false;
    for (const r of rows) {
      const q = qty[r.line.id];
      if (!q || q.strip + q.loose === 0) continue;
      any = true;
      raw += returnAmount(r.line, q.strip, q.loose);
    }
    const { rounded, roundOff } = roundToRupee(raw);
    const remaining = sale ? sale.totals.netPaise - sale.returnedPaise : 0;
    return { any, roundOff, refund: Math.min(rounded, remaining) };
  }, [rows, qty, sale]);

  const pickSale = (s: Sale) => {
    setSaleId(s.id);
    setQty({});
    setRefundMode(s.status === "udhaar" ? "udhaar_adjust" : "cash");
  };

  const resetSale = () => {
    setSaleId(null);
    setQty({});
    setNotes("");
  };

  const handleSave = async () => {
    if (!sale || !totals.any || saving) return;
    setSaving(true);
    try {
      const ret = await createSaleReturn({
        saleId: sale.id,
        reason,
        refundMode,
        notes,
        lines: rows.map((r) => ({
          saleLineId: r.line.id,
          qtyStrip: qty[r.line.id]?.strip ?? 0,
          qtyLoose: qty[r.line.id]?.loose ?? 0,
        })),
      });
      toast.success(`Return ${ret.returnNo} saved against ${sale.billNo}`, {
        description: `Refund ${inrFromPaise(ret.refundPaise)} (${REFUND_MODE_LABELS[ret.refundMode]}) · stock added back`,
      });
      setQty({});
      setNotes("");
    } catch (err) {
      // The server's own message ("can return at most 2", "Server offline"…)
      toast.error(
        err instanceof Error ? err.message : "Could not save the return",
      );
    } finally {
      setSaving(false);
    }
  };

  /* Keyboard: / search · ↑↓ + Enter pick bill · Ctrl+Enter save · Esc back */
  const nav = useListNavigation({
    items: list,
    getKey: (x: Sale) => x.id,
    onOpen: pickSale,
    enabled: !sale,
  });
  useEffect(() => {
    if (!nav.selectedKey) return;
    scrollRowIntoView(
      listRef.current?.querySelector<HTMLElement>(
        `[data-row-id="${CSS.escape(nav.selectedKey)}"]`,
      ) ?? null,
    );
  }, [nav.selectedKey]);
  // Start with the cursor in the search box
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useHotkeys([
    {
      keys: KEYS.focusSearch,
      enabled: !sale,
      handler: () => searchRef.current?.select(),
    },
    {
      keys: KEYS.save,
      allowInInputs: true,
      enabled: Boolean(sale) && totals.any,
      handler: handleSave,
    },
    {
      keys: "Escape",
      allowInInputs: true,
      // Esc in a non-empty search box clears it first (SearchInput handles that)
      when: (e) => !(e.target === searchRef.current && query !== ""),
      handler: () => (sale ? resetSale() : onClose()),
    },
  ]);

  return (
    <div className="h-full w-full min-h-0 overflow-hidden grid grid-cols-12 gap-3">
      {/* LEFT */}
      <div className="col-span-12 xl:col-span-9 min-h-0 h-full flex flex-col gap-2.5 overflow-hidden">
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
              Pick the bill → choose quantities → refund. Stock goes back to the
              same batch.
            </p>
          </div>
        </div>

        {!sale ? (
          <>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search bill no., customer or medicine..."
              className="flex-none"
              inputRef={searchRef}
            />
            <div className="flex items-center justify-between gap-3 -mt-1">
              <p className="text-[10px] text-muted-foreground">
                Bills from this app only — older imported history can't be
                returned here.
              </p>
              <KeyHints
                hints={[
                  { keys: ["ArrowUp", "ArrowDown"], label: "Move" },
                  { keys: "Enter", label: "Open bill" },
                  { keys: "Escape", label: "Back" },
                ]}
              />
            </div>
            {list.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No bills found"
                description="Try another bill number or name."
              />
            ) : (
              <div
                ref={listRef}
                className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-auto"
              >
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {[
                        "Bill",
                        "Customer",
                        "Date & Time",
                        "Items",
                        "Total (₹)",
                        "Returned (₹)",
                        "",
                      ].map((h) => (
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
                    {list.map((s) => (
                      <tr
                        key={s.id}
                        data-row-id={s.id}
                        aria-selected={nav.selectedKey === s.id}
                        className={cn(
                          "border-b border-border/50 hover:bg-primary/5 cursor-pointer bg-card",
                          nav.selectedKey === s.id && SELECTED_ROW,
                        )}
                        onClick={() => pickSale(s)}
                      >
                        <td className="px-3 py-2">
                          <CodeChip>{s.billNo}</CodeChip>
                        </td>
                        <td className="px-3 py-2">{s.customerName}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {formatDateTime(s.createdAt)}
                        </td>
                        <td className="px-3 py-2">{s.lines.length}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {inrFromPaise(s.totals.netPaise)}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">
                          {s.returnedPaise
                            ? inrFromPaise(s.returnedPaise)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-primary text-[10px] font-medium">
                          Select
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 shrink-0 bg-muted/40">
              <div className="text-[11px] min-w-0 truncate">
                <span className="font-semibold font-mono">{sale.billNo}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {sale.customerName} · {formatDateTime(sale.createdAt)} ·{" "}
                  {sale.status === "udhaar" ? "Udhaar" : "Paid"}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-7 shrink-0 rounded-lg text-[10px] px-2.5"
                onClick={resetSale}
              >
                Change bill
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {[
                      "Medicine",
                      "Batch / Expiry",
                      "Sold",
                      "Already returned",
                      "Return now",
                      "Refund (₹)",
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
                  {rows.map((r) => {
                    const l = r.line;
                    const q = qty[l.id] ?? { strip: 0, loose: 0 };
                    const amount = returnAmount(l, q.strip, q.loose);
                    const nothingLeft = r.maxStrip + r.maxLoose === 0;
                    return (
                      <tr
                        key={l.id}
                        className={cn(
                          "border-b border-border/50 bg-card [&>td]:align-middle",
                          nothingLeft && "opacity-50",
                        )}
                      >
                        <td className="px-2.5 py-2">
                          <p className="font-medium">{l.medicineName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Paid {inrFromPaise(l.amountPaise)}
                            {l.discountPercent > 0
                              ? ` · ${l.discountPercent}% off`
                              : ""}
                          </p>
                        </td>
                        <td className="px-2.5 py-2 space-y-1.5">
                          {l.allocations.map((a) => (
                            <BatchExpiry
                              key={a.batchId}
                              batchNo={a.batchNo}
                              expiry={a.expiry}
                              qty={
                                l.allocations.length > 1
                                  ? [
                                      a.qtyStrip
                                        ? `${a.qtyStrip} ${l.unit}`
                                        : "",
                                      a.qtyLoose ? `${a.qtyLoose} LSE` : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" + ")
                                  : undefined
                              }
                            />
                          ))}
                        </td>
                        <td className="px-2.5 py-2 tabular-nums whitespace-nowrap">
                          {[
                            l.qtyStrip ? `${l.qtyStrip} ${l.unit}` : "",
                            l.qtyLoose ? `${l.qtyLoose} LSE` : "",
                          ]
                            .filter(Boolean)
                            .join(" + ")}
                        </td>
                        <td className="px-2.5 py-2 tabular-nums text-muted-foreground whitespace-nowrap">
                          {r.returnedStrip + r.returnedLoose === 0
                            ? "—"
                            : [
                                r.returnedStrip
                                  ? `${r.returnedStrip} ${l.unit}`
                                  : "",
                                r.returnedLoose ? `${r.returnedLoose} LSE` : "",
                              ]
                                .filter(Boolean)
                                .join(" + ")}
                        </td>
                        <td className="px-2.5 py-2">
                          <div className="flex flex-col gap-1">
                            {l.qtyStrip > 0 ? (
                              <QtyStepper
                                value={q.strip}
                                max={r.maxStrip}
                                unitLabel={l.unit}
                                label={`${l.unit} of ${l.medicineName} to return`}
                                onChange={(v) =>
                                  setQty((s) => ({
                                    ...s,
                                    [l.id]: { ...q, strip: v },
                                  }))
                                }
                              />
                            ) : null}
                            {l.qtyLoose > 0 ? (
                              <QtyStepper
                                value={q.loose}
                                max={r.maxLoose}
                                unitLabel="LSE"
                                label={`Loose units of ${l.medicineName} to return`}
                                onChange={(v) =>
                                  setQty((s) => ({
                                    ...s,
                                    [l.id]: { ...q, loose: v },
                                  }))
                                }
                              />
                            ) : null}
                            {nothingLeft ? (
                              <p className="text-[9px] text-muted-foreground">
                                Fully returned
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2.5 py-2 font-semibold tabular-nums text-primary">
                          {amount ? inrFromPaise(amount) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT — summary */}
      <div className="col-span-12 xl:col-span-3 min-h-0 h-full overflow-hidden">
        <div className="h-full bg-card border border-border rounded-lg p-3 flex flex-col overflow-hidden">
          <h3 className="text-[11px] font-semibold mb-2 shrink-0">
            Return summary
          </h3>
          {!sale ? (
            <EmptyState
              icon={ReceiptText}
              title="Select a bill"
              description="Choose the customer's bill on the left."
              compact
              bordered={false}
            />
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 text-[11px] p-0.5">
                <label className="block">
                  <span className="text-[10px] text-muted-foreground block mb-1">
                    Reason
                  </span>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={cn(fieldClass, "h-8 text-[11px]")}
                  >
                    {SALE_RETURN_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <span className="text-[10px] text-muted-foreground block mb-1">
                    Refund mode
                  </span>
                  <div
                    className="grid grid-cols-3 gap-1"
                    role="radiogroup"
                    aria-label="Refund mode"
                  >
                    {(Object.keys(REFUND_MODE_LABELS) as RefundMode[]).map(
                      (m) => {
                        const disabled =
                          m === "udhaar_adjust" && sale.status !== "udhaar";
                        return (
                          <button
                            key={m}
                            type="button"
                            role="radio"
                            aria-checked={refundMode === m}
                            disabled={disabled}
                            title={
                              disabled ? "Only for udhaar bills" : undefined
                            }
                            onClick={() => setRefundMode(m)}
                            className={cn(
                              "rounded-md border px-1 py-1.5 text-[9px] font-medium disabled:opacity-40",
                              refundMode === m
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {REFUND_MODE_LABELS[m]}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>

                <label className="block">
                  <span className="text-[10px] text-muted-foreground block mb-1">
                    Notes
                  </span>
                  <textarea
                    value={notes}
                    maxLength={BILLING_LIMITS.notesMax}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className={cn(
                      fieldClass,
                      "h-auto py-1.5 text-[11px] resize-none",
                    )}
                  />
                </label>

                {previous.length > 0 ? (
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">
                      Earlier returns on this bill
                    </span>
                    <ul className="space-y-1">
                      {previous.map((r) => (
                        <li
                          key={r.id}
                          className="flex justify-between gap-2 text-[10px]"
                        >
                          <CodeChip>{r.returnNo}</CodeChip>
                          <span className="tabular-nums">
                            {inrFromPaise(r.refundPaise)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-border pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Round off</span>
                  <span className="tabular-nums">
                    {signedInrFromPaise(totals.roundOff)}
                  </span>
                </div>
                <div className="flex justify-between text-[13px] font-bold text-primary">
                  <span>Refund</span>
                  <span className="tabular-nums">
                    {inrFromPaise(totals.refund)}
                  </span>
                </div>
                <Button
                  type="button"
                  disabled={!totals.any || saving}
                  onClick={handleSave}
                  className="w-full h-8 rounded-md text-[11px] bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
                >
                  Save return
                  {totals.any ? ` · ${inrFromPaise(totals.refund)}` : ""}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
