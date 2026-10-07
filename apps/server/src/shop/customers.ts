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
      ...cleanCustomerInput(input, loadCustomers(raw, "id <> ?", [id])),
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
