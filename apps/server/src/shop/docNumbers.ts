import type { DatabaseSync } from "node:sqlite";
import { financialYear } from "@medicare/domain/lib/docNo";

/**
 * Document numbers already used in the financial year of `now` (bills,
 * returns…) — only this year's rows are read, however old the shop is.
 */
export function usedNumbers(
  raw: DatabaseSync,
  table: "sales" | "sale_returns" | "purchase_returns",
  column: "bill_no" | "return_no",
  now: Date,
): { no: string; at: string }[] {
  return raw
    .prepare(
      `SELECT ${column} AS no, created_at AS at FROM ${table} WHERE created_at >= ?`,
    )
    .all(financialYear(now).from.toISOString()) as { no: string; at: string }[];
}
