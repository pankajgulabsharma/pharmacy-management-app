/** Customer accounts (khata) and money received against udhaar */
import type { DatabaseSync } from "node:sqlite";
import { cleanCustomerInput } from "@medicare/domain/customers/clean";
import {
  customerSummaries,
  nextReceiptNo,
} from "@medicare/domain/customers/ledger";
import {
  CUSTOMER_LIMITS as L,
  type Customer,
  type CustomerInput,
  type CustomerPayment,
  type CustomerPaymentInput,
} from "@medicare/domain/customers/types";
import { validatePaymentIn } from "@medicare/domain/customers/validation";
import { RuleError } from "@medicare/domain/lib/errors";
import { newId } from "@medicare/domain/lib/id";
import { cleanText } from "@medicare/domain/lib/sanitize";
import type { ShopPatch } from "@medicare/domain/shop/patch";
import {
  loadCustomerPayments,
  loadCustomers,
  loadSaleReturns,
  loadSales,
} from "../db/mappers";
import * as t from "../db/schema";
import { insertRows, updateRow, writeTx } from "../db/sync";
import { NotFoundError } from "./errors";

export function customerById(raw: DatabaseSync, id: string): Customer | null {
  return loadCustomers(raw, "id = ?", [id])[0] ?? null;
}

/** What a customer owes right now — same ledger the Customers screen shows */
/** Loyalty points left on a customer's account (bills − returns) */
export function pointsBalanceOf(raw: DatabaseSync, customerId: string): number {
  const s = raw
    .prepare(
      "SELECT COALESCE(SUM(points_earned - points_redeemed), 0) n FROM sales WHERE customer_id = ?",
    )
    .get(customerId) as { n: number };
  const r = raw
    .prepare(
      `SELECT COALESCE(SUM(r.points_restored - r.points_reversed), 0) n
       FROM sale_returns r JOIN sales s ON s.id = r.sale_id WHERE s.customer_id = ?`,
    )
    .get(customerId) as { n: number };
  return s.n + r.n;
}

/** Every customer's points (only those with any) */
export function allPointsBalances(raw: DatabaseSync): Record<string, number> {
  const rows = raw
    .prepare(
      `SELECT customer_id id, SUM(n) n FROM (
         SELECT customer_id, points_earned - points_redeemed n FROM sales
         WHERE customer_id IS NOT NULL AND (points_earned > 0 OR points_redeemed > 0)
         UNION ALL
         SELECT s.customer_id, r.points_restored - r.points_reversed FROM sale_returns r
         JOIN sales s ON s.id = r.sale_id
         WHERE s.customer_id IS NOT NULL AND (r.points_restored > 0 OR r.points_reversed > 0)
       ) GROUP BY customer_id`,
    )
    .all() as { id: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.id, r.n]));
}

export function owedBy(raw: DatabaseSync, customerId: string): number {
  const c = customerById(raw, customerId);
  if (!c) return 0;
  const sales = loadSales(raw, "customer_id = ?", [customerId]);
  const returns = loadSaleReturns(
    raw,
    "sale_id IN (SELECT id FROM sales WHERE customer_id = ?)",
    [customerId],
  );
  const payments = loadCustomerPayments(raw, "customer_id = ?", [customerId]);
  return (
    customerSummaries([c], sales, returns, payments).get(c.id)?.balancePaise ??
    0
  );
}

export function addCustomer(
  raw: DatabaseSync,
  input: CustomerInput,
  now = new Date(),
) {
  return writeTx(raw, () => {
    const c: Customer = {
      id: newId("cus"),
      createdAt: now.toISOString(),
      ...cleanCustomerInput(input, loadCustomers(raw)),
    };
    insertRows(raw, t.customers, [c]);
    return { customer: c, patch: { customers: [c] } satisfies ShopPatch };
  });
}

export function updateCustomer(
  raw: DatabaseSync,
  id: string,
  input: CustomerInput,
) {
  return writeTx(raw, () => {
    const old = customerById(raw, id);
    if (!old) throw new NotFoundError("Customer not found");
    const next: Customer = {
      ...old,
      ...cleanCustomerInput(
        {
          ...input,
          // An older app doesn't send it → keep what is saved
          openingBalancePaise:
            input.openingBalancePaise ?? old.openingBalancePaise ?? 0,
        },
        loadCustomers(raw, "id <> ?", [id]),
      ),
    };
    updateRow(raw, t.customers, "id", next);
    return { customer: next, patch: { customers: [next] } satisfies ShopPatch };
  });
}

export function recordCustomerPayment(
  raw: DatabaseSync,
  input: CustomerPaymentInput,
  now = new Date(),
) {
  return writeTx(raw, () => {
    if (!customerById(raw, input.customerId))
      throw new NotFoundError("Customer not found");
    const v = validatePaymentIn(input, owedBy(raw, input.customerId));
    if (!v.ok) throw new RuleError(v.error);
    const all = raw
      .prepare("SELECT receipt_no AS receiptNo FROM customer_payments")
      .all() as { receiptNo: string }[];
    const p: CustomerPayment = {
      id: newId("pay"),
      receiptNo: nextReceiptNo(all),
      customerId: input.customerId,
      at: now.toISOString(),
      amountPaise: v.amountPaise,
      method: input.method,
      reference: cleanText(input.reference, L.referenceMax),
      note: cleanText(input.note, L.notesMax),
    };
    insertRows(raw, t.customerPayments, [p]);
    return { payment: p, patch: { customerPayments: [p] } satisfies ShopPatch };
  });
}
