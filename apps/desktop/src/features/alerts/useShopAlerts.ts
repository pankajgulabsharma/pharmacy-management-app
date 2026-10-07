import { useMemo } from "react";
import {
  CalendarClock,
  CalendarX,
  HandCoins,
  PackageX,
  PauseCircle,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { can } from "@medicare/domain/auth/permissions";
import { customerSummaries } from "@medicare/domain/customers/ledger";
import { customerStatus } from "@medicare/domain/customers/status";
import { inrRounded } from "@medicare/domain/lib/money";
import { stockLevel } from "@medicare/domain/medicines/stockLevel";
import { duesSummary } from "@medicare/domain/purchases/calc";
import { stockReport } from "@medicare/domain/reports/reports";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { useCustomerStore } from "@/features/customers/store/useCustomerStore";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useMedicinesWithStock } from "@/features/medicines/hooks/useMedicinesWithStock";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { tr } from "@/lib/i18n";

export type ShopAlert = {
  key: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  /** red = act today, orange = soon, amber = keep an eye */
  level: "red" | "orange" | "amber";
  /** The screen (with filter) where it can be dealt with */
  to: string;
};

const plural = (n: number, one: string, many: string) =>
  `${n} ${tr(n === 1 ? one : many)}`;

/**
 * Things that need attention — ONE list for the Dashboard and the header
 * bell, so they always agree. Each person only sees what their role can act
 * on (a cashier isn't shown supplier dues). Updates live with the data.
 */
export function useShopAlerts(): ShopAlert[] {
  const role = useAuthStore((s) => s.session?.user.role);
  const batches = useInventoryStore((s) => s.batches);
  const medicines = useMedicinesWithStock();
  const expiringDays = useSettingsStore((s) => s.inventory.expiringSoonDays);
  const purchases = usePurchaseStore((s) => s.purchases);
  const sales = useSalesStore((s) => s.sales);
  const saleReturns = useSalesStore((s) => s.saleReturns);
  const held = useSalesStore((s) => s.held);
  const customers = useCustomerStore((s) => s.customers);
  const payments = useCustomerStore((s) => s.payments);

  return useMemo(() => {
    const list: ShopAlert[] = [];
    const stock = stockReport(batches, medicines, expiringDays);

    if (stock.expired.length)
      list.push({
        key: "expired",
        title: plural(stock.expired.length, "batch expired", "batches expired"),
        desc: `${inrRounded(stock.expiredValuePaise)} ${tr("at cost — not sellable. Return to supplier or dispose.")}`,
        icon: CalendarX,
        level: "red",
        to: "/inventory?status=expired",
      });

    if (can(role, "stock")) {
      const dues = duesSummary(purchases, new Date());
      if (dues.overdueCount)
        list.push({
          key: "overdue",
          title: plural(
            dues.overdueCount,
            "invoice overdue",
            "invoices overdue",
          ),
          desc: `${inrRounded(dues.overduePaise)} ${tr("past the due date.")}`,
          icon: Wallet,
          level: "red",
          to: "/purchases?status=overdue",
        });
    }

    let out = 0;
    let low = 0;
    for (const m of medicines) {
      if (m.status !== "active") continue;
      const level = stockLevel(m);
      if (level === "out") out++;
      else if (level === "low") low++;
    }
    if (out)
      list.push({
        key: "out",
        title: plural(out, "medicine out of stock", "medicines out of stock"),
        desc: tr("Order these before the next customer asks."),
        icon: PackageX,
        level: "red",
        to: "/medicines?status=out",
      });

    if (stock.expiring.length)
      list.push({
        key: "expiring",
        title: plural(
          stock.expiring.length,
          "batch expiring soon",
          "batches expiring soon",
        ),
        desc: tr("Within {{days}} days — sell first or return in time.", {
          days: expiringDays,
        }),
        icon: CalendarClock,
        level: "orange",
        to: "/inventory?status=expiring",
      });

    if (low)
      list.push({
        key: "low",
        title: plural(low, "medicine running low", "medicines running low"),
        desc: tr("Below the minimum stock you set."),
        icon: TriangleAlert,
        level: "orange",
        to: "/medicines?status=low_only",
      });

    if (can(role, "sell")) {
      const sums = customerSummaries(customers, sales, saleReturns, payments);
      let owed = 0;
      let over = 0;
      for (const c of customers) {
        const s = sums.get(c.id);
        if (!s) continue;
        if (s.balancePaise > 0) owed += s.balancePaise;
        if (customerStatus(c, s) === "over") over++;
      }
      if (over)
        list.push({
          key: "over",
          title: plural(
            over,
            "customer over credit limit",
            "customers over credit limit",
          ),
          desc: tr("Collect before giving more udhaar."),
          icon: HandCoins,
          level: "orange",
          to: "/customers?filter=over",
        });
      else if (owed > 0)
        list.push({
          key: "udhaar",
          title: `${inrRounded(owed)} ${tr("udhaar to collect")}`,
          desc: tr("Customers who bought on credit — open their accounts."),
          icon: HandCoins,
          level: "amber",
          to: "/customers?filter=due",
        });
      if (held.length)
        list.push({
          key: "held",
          title: plural(held.length, "bill on hold", "bills on hold"),
          desc: tr("Waiting to be finished — open Held bills on Billing."),
          icon: PauseCircle,
          level: "amber",
          to: "/billing",
        });
    }
    return list;
  }, [
    role,
    batches,
    medicines,
    expiringDays,
    purchases,
    sales,
    saleReturns,
    held,
    customers,
    payments,
  ]);
}

/** Icon colours per level (badge + list) */
export const ALERT_TONE: Record<ShopAlert["level"], string> = {
  red: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  orange:
    "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
};
