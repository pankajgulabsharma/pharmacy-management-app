import { Pencil as PencilIcon, PillBottle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CodeChip } from "@/components/common/CodeChip";
import { ExpiryText, type ExpiryState } from "@/components/common/ExpiryText";
import type { MedicineWithStock } from "../types";
import { CATEGORY_LABELS, canSellLoose, formatPackLabel } from "../types";
import { isExpired, isExpiringSoon } from "@/features/inventory/utils/stock";

type Props = {
  items: MedicineWithStock[];
  onEdit: (m: MedicineWithStock) => void;
  onDelete: (m: MedicineWithStock) => void;
};

export function MedicineTable({ items, onEdit, onDelete }: Props) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={PillBottle}
        title="No medicines found"
        description="Try changing the search or filters, or add a new medicine."
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              {[
                ["Medicine", "text-left"],
                ["Category", "text-left"],
                ["Brand / HSN", "text-left"],
                ["Rack", "text-left"],
                ["Pack", "text-left"],
                ["Expiry", "text-left"],
                ["Stock", "text-left"],
                ["MRP (₹)", "text-right"],
                ["Sale (₹)", "text-right"],
                ["Status", "text-left"],
                ["", "text-right"],
              ].map(([label, align]) => (
                <th
                  key={label || "actions"}
                  className={cn(
                    "px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground whitespace-nowrap",
                    align,
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((m) => {
              const out = m.stockStrip === 0 && m.stockLoose === 0;
              const low = !out && m.stockStrip < m.minStock;
              const looseOk = canSellLoose(m.unit, m.allowLoose);
              const expiryState: ExpiryState = !m.nearestExpiry
                ? "ok"
                : isExpired(m.nearestExpiry)
                  ? "expired"
                  : isExpiringSoon(m.nearestExpiry)
                    ? "expiring"
                    : "ok";

              return (
                <tr
                  key={m.id}
                  className="border-b border-border/50 last:border-0 bg-card hover:bg-muted/30"
                >
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground leading-tight">
                      {m.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {m.salt || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-[10px] text-muted-foreground whitespace-nowrap">
                    {CATEGORY_LABELS[m.category]}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="leading-tight">{m.brand}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {m.hsn}
                    </p>
                  </td>

                  {/* Rack */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {m.rack ? (
                      <CodeChip tone="primary">{m.rack}</CodeChip>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Pack */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <p className="text-foreground">
                      {formatPackLabel(m.unit, m.unitsPerStrip)}
                    </p>
                    {looseOk && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Loose allowed
                      </p>
                    )}
                  </td>

                  {/* Expiry */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <ExpiryText value={m.nearestExpiry} state={expiryState} />
                  </td>

                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        out
                          ? "text-red-500"
                          : low
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {m.stockStrip} {m.unit}
                      {looseOk && m.stockLoose > 0 ? ` + ${m.stockLoose}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                    {m.mrp.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-primary whitespace-nowrap">
                    {m.salePrice.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <StatusBadge
                      tone={m.status === "active" ? "success" : "neutral"}
                      shape="rounded"
                    >
                      {m.status === "active" ? "Active" : "Inactive"}
                    </StatusBadge>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(m)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Edit ${m.name}`}
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(m)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        aria-label={`Delete ${m.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
