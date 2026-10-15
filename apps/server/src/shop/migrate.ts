/**
 * Starting with MediCare when the shop already used other software (Marg,
 * Tally, GoFrugal, a khata book…): bring over customers with their old
 * udhaar, and suppliers with the old dues. Medicines + opening stock come
 * in through the medicine import (importStock.ts).
 *
 * Re-running an import never doubles anything: a customer (same mobile or
 * name) or supplier (same GSTIN or name) already here is skipped.
 */
import type { DatabaseSync } from "node:sqlite";
import { cleanCustomerInput } from "@medicare/domain/customers/clean";
import type { Customer, CustomerInput } from "@medicare/domain/customers/types";
import { RuleError } from "@medicare/domain/lib/errors";
import { newId } from "@medicare/domain/lib/id";
import {
  buildOpeningDue,
  type OpeningDueInput,
} from "@medicare/domain/purchases/opening";
import type { Purchase } from "@medicare/domain/purchases/types";
import type { ShopPatch } from "@medicare/domain/shop/patch";
import {
  assertUniqueSupplier,
  cleanSupplierInput,
} from "@medicare/domain/suppliers/clean";
import type { Supplier, SupplierInput } from "@medicare/domain/suppliers/types";
import {
  insertPurchase,
  loadCustomers,
  loadPurchases,
  loadSuppliersSync,
} from "../db/mappers";
import * as t from "../db/schema";
import { insertRows, writeTx } from "../db/sync";
import { NotFoundError } from "./errors";

export type ImportResult = {
  created: number;
  /** Already here — skipped, nothing doubled */
  existing: number;
  /** Rows with a problem (row = line in the file, header = 1) */
  errors: { row: number; name: string; error: string }[];
  /** Old balance carried over (₹ in paise) */
  openingPaise: number;
};

const message = (e: unknown) =>
  e instanceof RuleError ? e.message : "Could not read this row";

/** One supplier's old dues (Supplier → "Old balance") */
export function addOpeningDue(
  raw: DatabaseSync,
  supplierId: string,
  input: OpeningDueInput,
  now = new Date(),
) {
  return writeTx(raw, () => {
    const s = loadSuppliersSync(raw).find((x) => x.id === supplierId);
    if (!s) throw new NotFoundError("Supplier not found");
    const p = buildOpeningDue(s, input, now);
    if (
      loadPurchases(raw, "supplier_id = ? AND invoice_no = ?", [
        s.id,
        p.invoiceNo,
      ]).length
    )
      throw new RuleError(
        `${s.name} already has an entry “${p.invoiceNo}” — give the old bill no.`,
      );
    insertPurchase(raw, p);
    return { purchase: p, patch: { purchases: [p] } satisfies ShopPatch };
  });
}

export function importCustomers(
  raw: DatabaseSync,
  rows: readonly CustomerInput[],
  now = new Date(),
) {
  return writeTx(raw, () => {
    const all = loadCustomers(raw);
    const result: ImportResult = {
      created: 0,
      existing: 0,
      errors: [],
      openingPaise: 0,
    };
    const added: Customer[] = [];
    rows.forEach((input, i) => {
      try {
        const name = input.name.trim().toLowerCase();
        const phone = input.phone.replace(/\D/g, "");
        if (
          all.some(
            (c) =>
              (phone && c.phone === phone) ||
              (!phone && c.name.toLowerCase() === name),
          )
        ) {
          result.existing++;
          return;
        }
        const c: Customer = {
          id: newId("cus"),
          createdAt: now.toISOString(),
          ...cleanCustomerInput({ ...input, status: "active" }, all),
        };
        insertRows(raw, t.customers, [c]);
        all.push(c);
        added.push(c);
        result.created++;
        result.openingPaise += c.openingBalancePaise ?? 0;
      } catch (e) {
        result.errors.push({ row: i + 2, name: input.name, error: message(e) });
      }
    });
    return { result, patch: { customers: added } satisfies ShopPatch };
  });
}

export type SupplierImportRow = SupplierInput & {
  /** Old dues to this supplier (paise, 0 = none) */
  openingDuePaise: number;
};

export function importSuppliers(
  raw: DatabaseSync,
  rows: readonly SupplierImportRow[],
  now = new Date(),
) {
  return writeTx(raw, () => {
    const all: Supplier[] = loadSuppliersSync(raw);
    const result: ImportResult = {
      created: 0,
      existing: 0,
      errors: [],
      openingPaise: 0,
    };
    const dues: Purchase[] = [];
    rows.forEach(({ openingDuePaise, ...input }, i) => {
      try {
        const clean = cleanSupplierInput({ ...input, status: "active" });
        try {
          assertUniqueSupplier(all, clean);
        } catch {
          result.existing++;
          return;
        }
        const s: Supplier = {
          id: newId("sup"),
          ...clean,
          createdAt: now.toISOString(),
        };
        insertRows(raw, t.suppliers, [s]);
        all.push(s);
        result.created++;
        if (openingDuePaise > 0) {
          const p = buildOpeningDue(s, { amountPaise: openingDuePaise }, now);
          insertPurchase(raw, p);
          dues.push(p);
          result.openingPaise += openingDuePaise;
        }
      } catch (e) {
        result.errors.push({ row: i + 2, name: input.name, error: message(e) });
      }
    });
    return { result, patch: { purchases: dues } satisfies ShopPatch };
  });
}
