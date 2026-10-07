/**
 * Bills, sales returns, held bills — the same rules the app used, now on the
 * server. Stock (FEFO) and bill are saved together or not at all.
 */
import type { DatabaseSync } from "node:sqlite";
import {
  SaleError,
  buildSale,
  nextBillNo,
} from "@medicare/domain/billing/sale";
import {
  buildSaleReturn,
  nextSaleReturnNo,
} from "@medicare/domain/billing/saleReturn";
import {
  BILLING_LIMITS,
  type HeldBill,
  type Sale,
  type SaleInput,
  type SaleReturnInput,
} from "@medicare/domain/billing/types";
import { applyChange } from "@medicare/domain/inventory/ledger";
import { newId } from "@medicare/domain/lib/id";
import { cleanText } from "@medicare/domain/lib/sanitize";
import type { ShopPatch } from "@medicare/domain/shop/patch";
import {
  heldToRow,
  insertSale,
  insertSaleReturn,
  loadBatches,
  loadHeld,
  loadMedicinesSync,
  loadSaleReturns,
  loadSales,
  saveStock,
} from "../db/mappers";
import * as t from "../db/schema";
import { insertRows, updateRow, writeTx } from "../db/sync";
import { customerById, owedBy } from "./customers";
import { NotFoundError } from "./errors";

export function completeSale(
  raw: DatabaseSync,
  input: SaleInput,
  now = new Date(),
) {
  return writeTx(raw, () => {
    // Udhaar goes on an active customer account, within its credit limit
    let customerName = input.customerName;
    const customer =
      input.payment.method === "udhaar"
        ? customerById(raw, input.customerId ?? "")
        : null;
    if (input.payment.method === "udhaar") {
      if (!customer)
        throw new SaleError("Choose the customer's account for udhaar");
      if (customer.status !== "active")
        throw new SaleError(`${customer.name}'s account is inactive`);
      customerName = customer.name;
    }
    const medicines = new Map(loadMedicinesSync(raw).map((m) => [m.id, m]));
    const before = loadBatches(raw);
    const billNos = raw
      .prepare("SELECT bill_no AS billNo FROM sales")
      .all() as { billNo: string }[];
    const { sale, change } = buildSale(
      { ...input, customerName },
      medicines,
      before,
      nextBillNo(billNos),
      now,
    );

    if (
      customer &&
      customer.creditLimitPaise > 0 &&
      owedBy(raw, customer.id) + sale.totals.netPaise >
        customer.creditLimitPaise
    ) {
      throw new SaleError(
        `Over ${customer.name}'s udhaar limit of ₹${(customer.creditLimitPaise / 100).toLocaleString("en-IN")}`,
      );
    }

    // Stock out (FEFO) — throws if anything is short, and nothing is saved
    const r = applyChange(before, {
      refId: sale.id,
      type: "sale",
      note: `Sale ${sale.billNo} · ${sale.customerName}`,
      at: now,
      lines: change,
    });
    const saved = saveStock(raw, before, r.batches, r.movements);
    insertSale(raw, sale);
    return { sale, patch: { sales: [sale], ...saved } satisfies ShopPatch };
  });
}

export function createSaleReturn(
  raw: DatabaseSync,
  input: SaleReturnInput,
  now = new Date(),
) {
  return writeTx(raw, () => {
    const [sale] = loadSales(raw, "id = ?", [input.saleId]);
    if (!sale) throw new NotFoundError("Bill not found");
    const all = loadSaleReturns(raw);
    const { ret, change } = buildSaleReturn(
      sale,
      input,
      all,
      nextSaleReturnNo(all),
      now,
    );
    const before = loadBatches(raw);
    const r = applyChange(before, {
      refId: ret.id,
      type: "sale_return",
      note: `Sales return ${ret.returnNo} · ${sale.billNo}`,
      at: now,
      lines: change,
    });
    const saved = saveStock(raw, before, r.batches, r.movements);
    insertSaleReturn(raw, ret);
    const updated: Sale = {
      ...sale,
      returnedPaise: sale.returnedPaise + ret.refundPaise,
    };
    updateRow(raw, t.sales, "id", {
      id: sale.id,
      returnedPaise: updated.returnedPaise,
    });
    return {
      ret,
      patch: {
        saleReturns: [ret],
        sales: [updated],
        ...saved,
      } satisfies ShopPatch,
    };
  });
}

export type HoldInput = Omit<HeldBill, "id" | "heldAt">;

/** Park a cart (stock is NOT reserved — it's checked again on resume) */
export function holdBill(
  raw: DatabaseSync,
  draft: HoldInput,
  now = new Date(),
) {
  return writeTx(raw, () => {
    if (draft.lines.length === 0) throw new SaleError("Nothing to hold");
    const count = (
      raw.prepare("SELECT count(*) n FROM held_bills").get() as { n: number }
    ).n;
    if (count >= BILLING_LIMITS.maxHeld)
      throw new SaleError(`You can hold up to ${BILLING_LIMITS.maxHeld} bills`);
    const bill: HeldBill = {
      id: newId("held"),
      heldAt: now.toISOString(),
      customerName: cleanText(draft.customerName, BILLING_LIMITS.customerMax),
      doctor: cleanText(draft.doctor, 80),
      counter: cleanText(draft.counter, 30),
      lines: draft.lines
        .slice(0, BILLING_LIMITS.maxLines)
        .map((l) => ({ ...l })),
    };
    insertRows(raw, t.heldBills, [heldToRow(bill)]);
    return { bill, patch: { held: [bill] } satisfies ShopPatch };
  });
}

/** Take a held bill off the list (resume or discard). Only one counter can take it. */
export function takeHeld(raw: DatabaseSync, id: string) {
  return writeTx(raw, () => {
    const bill = loadHeld(raw).find((h) => h.id === id);
    if (!bill)
      throw new NotFoundError(
        "Held bill not found — another counter may have resumed it",
      );
    raw.prepare("DELETE FROM held_bills WHERE id = ?").run(id);
    return { bill, patch: { heldRemoved: [id] } satisfies ShopPatch };
  });
}
