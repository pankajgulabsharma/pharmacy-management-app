import { useTranslation } from "react-i18next";
import type { MedicineSearchResult } from "../data/mockBillingData";
import { ScanBarcode, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/EmptyState";

type Props = {
  results: MedicineSearchResult[];
  query: string;
  selectedId: string | null;
  focusedIndex: number;
  onSelect: (item: MedicineSearchResult) => void;
  onHoverIndex: (index: number) => void;
};

export function SearchResultsTable({
  results,
  query,
  selectedId,
  focusedIndex,
  onSelect,
  onHoverIndex,
}: Props) {
  const { t } = useTranslation();

  if (!query.trim()) {
    return <EmptyState icon={ScanBarcode} title={t("billing.typeToSearch")} />;
  }

  if (results.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={`${t("billing.noResults")} “${query.trim()}”`}
        description="Check the spelling, or search by salt or barcode."
      />
    );
  }

  const headers = [
    { key: "billing.medicineName", align: "text-left" },
    { key: "billing.hsn", align: "text-left" },
    { key: "billing.rack", align: "text-left" },
    { key: "billing.batchExpiry", align: "text-left" },
    { key: "billing.brand", align: "text-left" },
    { key: "billing.stock", align: "text-left" },
    { key: "billing.mrp", align: "text-right" },
    { key: "billing.salePrice", align: "text-right" },
  ] as const;

  return (
    <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0 z-20">
            <tr>
              {headers.map((h) => (
                <th
                  key={h.key}
                  className={cn(
                    "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide",
                    "bg-primary text-primary-foreground",
                    h.align,
                  )}
                >
                  {t(h.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((item, index) => {
              const outOfStock = item.stockStrip <= 0 && item.stockLoose <= 0;
              const isActive = focusedIndex === index || selectedId === item.id;

              return (
                <tr
                  key={item.id}
                  onMouseEnter={() => onHoverIndex(index)}
                  onClick={() => !outOfStock && onSelect(item)}
                  className={cn(
                    "border-b border-border/50 last:border-0 transition-colors bg-card",
                    outOfStock && "opacity-50 cursor-not-allowed",
                    !outOfStock && "cursor-pointer",
                    isActive &&
                      "bg-primary/10 ring-1 ring-inset ring-primary/30",
                  )}
                >
                  <td className="px-3 py-2 font-medium text-foreground">
                    {item.name}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {item.hsn}
                  </td>
                  <td className="px-3 py-2">{item.rack}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium leading-tight">
                      {item.batch}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Exp {item.expiry}
                    </div>
                  </td>
                  <td className="px-3 py-2">{item.brand}</td>
                  <td className="px-3 py-2">
                    {outOfStock ? (
                      <span className="text-red-500 font-semibold">0 STP</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {item.stockStrip} {item.unit}
                        {item.stockLoose > 0 ? ` + ${item.stockLoose} LSE` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {item.mrp.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">
                    {item.salePrice.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground flex justify-between bg-card shrink-0">
        <span>
          {t("billing.showingResults", { count: results.length })} “{query}”
        </span>
        <span className="text-primary font-medium">
          {t("billing.keyboardHint")}
        </span>
      </div>
    </div>
  );
}
