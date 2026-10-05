import { useMemo } from "react";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { getDuePaise, getPaymentStatus } from "@/features/purchases/utils/calc";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useMedicinesWithStock } from "@/features/medicines/hooks/useMedicinesWithStock";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { presetRange } from "@/features/reports/utils/period";
import { salesReport, stockReport } from "@/features/reports/utils/reports";

/** % change vs a previous value; null when there is nothing to compare */
function change(now: number, before: number): number | null {
  return before > 0 ? Math.round(((now - before) / before) * 100) : null;
}

/**
 * Everything the Dashboard shows, from the live stores — computed with the
 * same report functions as the Reports screen, so the numbers always match.
 */
export function useDashboardData() {
  const sales = useSalesStore((s) => s.sales);
  const saleReturns = useSalesStore((s) => s.saleReturns);
  const held = useSalesStore((s) => s.held);
  const purchases = usePurchaseStore((s) => s.purchases);
  const batches = useInventoryStore((s) => s.batches);
  const medicines = useMedicinesWithStock();
  const expiringDays = useSettingsStore((s) => s.inventory.expiringSoonDays);

  return useMemo(() => {
    const today = salesReport(
      sales,
      saleReturns,
      batches,
      presetRange("today"),
    );
    const yesterday = salesReport(
      sales,
      saleReturns,
      batches,
      presetRange("yesterday"),
    );
    const week = salesReport(sales, saleReturns, batches, presetRange("7d"));
    const month = salesReport(sales, saleReturns, batches, presetRange("30d"));
    const stock = stockReport(batches, medicines, expiringDays);

    // Stock health by medicine (active only)
    let inStock = 0;
    let low = 0;
    let out = 0;
    for (const m of medicines) {
      if (m.status !== "active") continue;
      const qty = m.unit === "LSE" ? m.stockLoose : m.stockStrip;
      if (m.stockStrip === 0 && m.stockLoose === 0) out++;
      else if (qty < m.minStock) low++;
      else inStock++;
    }

    // Money owed to suppliers
    const now = new Date();
    let duePaise = 0;
    let overduePaise = 0;
    let overdueCount = 0;
    for (const p of purchases) {
      if (p.status === "cancelled") continue;
      const due = getDuePaise(p);
      duePaise += due;
      if (due > 0 && getPaymentStatus(p, now) === "overdue") {
        overduePaise += due;
        overdueCount++;
      }
    }

    return {
      today,
      salesChange: change(
        today.netAfterReturnsPaise,
        yesterday.netAfterReturnsPaise,
      ),
      billsChange: change(today.billCount, yesterday.billCount),
      week,
      month,
      stock,
      health: { inStock, low, out },
      lowStockList: stock.lowStock,
      supplier: { duePaise, overduePaise, overdueCount },
      heldCount: held.length,
      expiringDays,
      recentSales: sales.slice(0, 6),
    };
  }, [sales, saleReturns, held, purchases, batches, medicines, expiringDays]);
}

export type DashboardData = ReturnType<typeof useDashboardData>;
