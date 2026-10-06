import { useMemo } from "react";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { duesSummary } from "@/features/purchases/utils/calc";
import { useCustomerStore } from "@/features/customers/store/useCustomerStore";
import {
  customerSummaries,
  totalUdhaar,
} from "@/features/customers/utils/ledger";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useMedicinesWithStock } from "@/features/medicines/hooks/useMedicinesWithStock";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { stockLevel } from "@/features/medicines/utils/stockLevel";
import { presetRange } from "@/features/reports/utils/period";
import { percentChange } from "@/lib/format";
import { salesReport, stockReport } from "@/features/reports/utils/reports";

/**
 * Everything the Dashboard shows, from the live stores — computed with the
 * same report functions as the Reports screen, so the numbers always match.
 */
export function useDashboardData() {
  const sales = useSalesStore((s) => s.sales);
  const saleReturns = useSalesStore((s) => s.saleReturns);
  const held = useSalesStore((s) => s.held);
  const customers = useCustomerStore((s) => s.customers);
  const customerPayments = useCustomerStore((s) => s.payments);
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
      const level = stockLevel(m); // sellable stock only, same rule everywhere
      if (level === "out") out++;
      else if (level === "low") low++;
      else inStock++;
    }

    // Money owed to suppliers — same function as everywhere else
    const supplier = duesSummary(purchases, new Date());

    return {
      today,
      salesChange: percentChange(
        today.netAfterReturnsPaise,
        yesterday.netAfterReturnsPaise,
      ),
      billsChange: percentChange(today.billCount, yesterday.billCount),
      week,
      month,
      stock,
      health: { inStock, low, out },
      lowStockList: stock.lowStock,
      supplier,
      // Udhaar customers owe us — same ledger as the Customers screen
      udhaarPaise: totalUdhaar(
        customerSummaries(customers, sales, saleReturns, customerPayments),
      ),
      heldCount: held.length,
      expiringDays,
      recentSales: sales.slice(0, 6),
    };
  }, [
    sales,
    saleReturns,
    held,
    customers,
    customerPayments,
    purchases,
    batches,
    medicines,
    expiringDays,
  ]);
}

export type DashboardData = ReturnType<typeof useDashboardData>;
