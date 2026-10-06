import type { Tone } from "../lib/tone";
import type { SupplierWithSummary } from "./types";

/**
 * ONE status per supplier — used by the filter chips, their counts and the
 * Status column, so they always agree and the chips add up to "All".
 * Priority: inactive → overdue → due → credit → settled
 */
export type SupplierStatus =
  "inactive" | "overdue" | "due" | "credit" | "settled";

export function supplierStatus(
  s: Pick<
    SupplierWithSummary,
    "status" | "overduePaise" | "outstandingPaise" | "creditPaise"
  >,
): SupplierStatus {
  if (s.status === "inactive") return "inactive";
  if (s.overduePaise > 0) return "overdue";
  if (s.outstandingPaise > 0) return "due";
  if (s.creditPaise > 0) return "credit";
  return "settled";
}

export const SUPPLIER_STATUS_LABEL: Record<SupplierStatus, string> = {
  overdue: "Overdue",
  due: "Due",
  credit: "Credit",
  settled: "Settled",
  inactive: "Inactive",
};

export const SUPPLIER_STATUS_TONE: Record<SupplierStatus, Tone> = {
  overdue: "danger",
  due: "caution",
  credit: "info",
  settled: "success",
  inactive: "neutral",
};
