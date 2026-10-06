import type { BadgeTone } from "@/components/common/StatusBadge";
import type { Customer } from "../types";
import type { CustomerSummary } from "./ledger";

/**
 * ONE status per customer — chips, counts and the Status column all use it.
 * Priority: inactive → over limit → due → clear
 */
export type CustomerStatus = "inactive" | "over" | "due" | "clear";

export function customerStatus(
  c: Pick<Customer, "status" | "creditLimitPaise">,
  s: Pick<CustomerSummary, "balancePaise">,
): CustomerStatus {
  if (c.status === "inactive") return "inactive";
  if (c.creditLimitPaise > 0 && s.balancePaise > c.creditLimitPaise)
    return "over";
  if (s.balancePaise > 0) return "due";
  return "clear";
}

export const CUSTOMER_STATUS_LABEL: Record<CustomerStatus, string> = {
  due: "Due",
  over: "Over limit",
  clear: "Clear",
  inactive: "Inactive",
};

export const CUSTOMER_STATUS_TONE: Record<CustomerStatus, BadgeTone> = {
  due: "caution",
  over: "danger",
  clear: "success",
  inactive: "neutral",
};
