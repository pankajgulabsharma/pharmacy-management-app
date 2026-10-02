import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { BillLineItem } from "../types";
import { calcLineAmount, getLooseUnitPrice } from "../types";
import { formatPackLabel } from "@/features/medicines/types";

type Props = {
  items: BillLineItem[];
  onChangeQty: (lineId: string, qtyStrip: number, qtyLoose: number) => void;
  onChangeDiscount: (lineId: string, discountPercent: number) => void;
  onRemove: (lineId: string) => void;
};

export function BillItemsTable({
  items,
  onChangeQty,
  onChangeDiscount,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const lastLineId = items[items.length - 1]?.lineId;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      prevCountRef.current = items.length;
      return;
    }

    if (items.length > prevCountRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.scrollTo({
            top: el.scrollHeight,
            behavior: "smooth",
          });
        });
      });
    }

    prevCountRef.current = items.length;
  }, [items.length, lastLineId]);

  if (items.length === 0) return null;

  return (
    <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              {(
                [
                  ["#", "text-left", ""],
                  [t("billing.medicineName"), "text-left", ""],
                  [t("billing.batchExpiry"), "text-left", ""],
                  ["Qty", "text-left", "whitespace-nowrap"],
                  [t("billing.mrp"), "text-right", ""],
                  ["Sale (₹)", "text-right", ""],
                  ["Disc %", "text-right", ""],
                  [t("billing.amount"), "text-right", ""],
                  ["", "", ""],
                ] as const
              ).map(([label, align, extra], i) => (
                <th
                  key={i}
                  className={`px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground ${align} ${extra}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const m = item.medicine;
              const ups = m.unitsPerStrip > 0 ? m.unitsPerStrip : 1;
              const packUnit = m.unit ?? "STP";
              const showLoose =
                (m.allowLoose ?? packUnit === "STP") &&
                (packUnit === "STP" || packUnit === "LSE");
              const lsePrice = getLooseUnitPrice(m);
              const amount = calcLineAmount(item);

              return (
                <tr
                  key={item.lineId}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 bg-card"
                >
                  <td className="px-2.5 py-2 text-muted-foreground bg-card">
                    {index + 1}
                  </td>

                  <td className="px-2.5 py-2 bg-card">
                    <p className="font-medium text-foreground leading-tight">
                      {m.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {m.brand}, HSN {m.hsn}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {m.rack}
                    </p>
                  </td>

                  <td className="px-2.5 py-2 bg-card">
                    <p className="font-medium leading-tight">{m.batch}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Exp {m.expiry}
                    </p>
                  </td>

                  <td className="px-2.5 py-2 bg-card max-w-[150px]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-muted-foreground w-8 shrink-0">
                          {packUnit}
                        </span>
                        <button
                          type="button"
                          className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40"
                          disabled={item.qtyStrip <= 0}
                          onClick={() =>
                            onChangeQty(
                              item.lineId,
                              Math.max(0, item.qtyStrip - 1),
                              item.qtyLoose,
                            )
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center tabular-nums font-medium">
                          {item.qtyStrip}
                        </span>
                        <button
                          type="button"
                          className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                          onClick={() =>
                            onChangeQty(
                              item.lineId,
                              item.qtyStrip + 1,
                              item.qtyLoose,
                            )
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {showLoose && (
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-muted-foreground w-8 shrink-0">
                            LSE
                          </span>
                          <button
                            type="button"
                            className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40"
                            disabled={item.qtyLoose <= 0}
                            onClick={() =>
                              onChangeQty(
                                item.lineId,
                                item.qtyStrip,
                                Math.max(0, item.qtyLoose - 1),
                              )
                            }
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center tabular-nums font-medium">
                            {item.qtyLoose}
                          </span>
                          <button
                            type="button"
                            className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                            onClick={() =>
                              onChangeQty(
                                item.lineId,
                                item.qtyStrip,
                                item.qtyLoose + 1,
                              )
                            }
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      <p className="text-[9px] text-muted-foreground leading-tight">
                        {formatPackLabel(packUnit, ups)}
                        {showLoose ? ` · 1 LSE = ₹${lsePrice.toFixed(2)}` : ""}
                      </p>
                    </div>
                  </td>

                  <td className="px-2.5 py-2 text-right tabular-nums bg-card">
                    {m.mrp.toFixed(2)}
                  </td>

                  <td className="px-2.5 py-2 text-right tabular-nums bg-card">
                    {m.salePrice.toFixed(2)}
                  </td>

                  <td className="px-2 py-2 text-right bg-card">
                    <select
                      value={item.discountPercent}
                      onChange={(e) =>
                        onChangeDiscount(
                          item.lineId,
                          Number(e.target.value) || 0,
                        )
                      }
                      className="h-7 rounded-md border border-border/50 bg-muted/40 px-1.5 text-[11px] outline-none focus:ring-1 focus:ring-ring"
                    >
                      {[0, 5, 10, 15, 20].map((d) => (
                        <option key={d} value={d}>
                          {d}%
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-2.5 py-2 text-right font-semibold tabular-nums text-primary bg-card">
                    ₹{amount.toFixed(2)}
                  </td>

                  <td className="px-2 py-2 bg-card">
                    <button
                      type="button"
                      onClick={() => onRemove(item.lineId)}
                      className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
