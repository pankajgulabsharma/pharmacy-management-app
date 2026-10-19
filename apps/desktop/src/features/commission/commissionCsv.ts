import type { Sale } from "@medicare/domain/billing/types";
import type { StockBatch } from "@medicare/domain/inventory/types";
import type { DateRange } from "@medicare/domain/reports/period";
import {
  commissionReport,
  periodOf,
  type CommissionRow,
} from "@medicare/domain/reports/commission";
import { formatPaise } from "@medicare/domain/lib/money";
import { toCsv } from "@/lib/csv";
import { useCommissionStore } from "./useCommissionStore";
import { hasFeature } from "@medicare/domain/license/plan";
import { useLicenseStore } from "@/features/license/useLicenseStore";

/** Doctors + staff of the period as a CSV (the Reports "Export CSV") */
export function commissionCsv(
  sales: readonly Sale[],
  batches: readonly StockBatch[],
  range: DateRange,
): string {
  const { rates, payouts } = useCommissionStore.getState();
  const r = commissionReport(
    sales,
    batches,
    rates,
    range,
    payouts,
    periodOf(range),
  );
  const plan = useLicenseStore.getState().state?.plan ?? "multi";
  const staff = hasFeature(plan, "staffCommission") ? r.staff : [];
  return toCsv(
    [...r.doctors, ...staff],
    [
      {
        header: "Type",
        value: (x: CommissionRow) => (x.kind === "doctor" ? "Doctor" : "Staff"),
      },
      { header: "Name", value: (x) => x.name },
      { header: "Bills", value: (x) => x.bills },
      { header: "Sales (Rs)", value: (x) => formatPaise(x.salesPaise) },
      { header: "Profit (Rs)", value: (x) => formatPaise(x.profitPaise) },
      { header: "Rate %", value: (x) => x.ratePct },
      {
        header: "Commission (Rs)",
        value: (x) => formatPaise(x.commissionPaise),
      },
      { header: "Paid (Rs)", value: (x) => formatPaise(x.paidPaise) },
      { header: "Due (Rs)", value: (x) => formatPaise(x.duePaise) },
    ],
  );
}
