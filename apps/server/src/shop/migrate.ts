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
  /** Undo this import later (while none of these parties is used) */
  importId: string;
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
      importId: newId("imp"),
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
    recordImport(raw, {
      id: result.importId,
      kind: "customers",
      at: now.toISOString(),
      rows: rows.length,
      createdIds: added.map((c) => c.id),
      openingIds: [],
      openingPaise: result.openingPaise,
      existing: result.existing,
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
      importId: newId("imp"),
      created: 0,
      existing: 0,
      errors: [],
      openingPaise: 0,
    };
    const dues: Purchase[] = [];
    const createdIds: string[] = [];
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
        createdIds.push(s.id);
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
    recordImport(raw, {
      id: result.importId,
      kind: "suppliers",
      at: now.toISOString(),
      rows: rows.length,
      createdIds,
      openingIds: dues.map((p) => p.id),
      openingPaise: result.openingPaise,
      existing: result.existing,
    });
    return { result, patch: { purchases: dues } satisfies ShopPatch };
  });
}

/* ------------------------------------------------------------------ */
/* Undo a customer / supplier import                                  */
/* ------------------------------------------------------------------ */

export type PartyKind = "customers" | "suppliers";

export type PartyImport = {
  id: string;
  kind: PartyKind;
  at: string;
  rows: number;
  created: number;
  existing: number;
  openingPaise: number;
  undoneAt: string;
};

type PartyImportRow = {
  id: string;
  kind: PartyKind;
  at: string;
  rows: number;
  created_ids_json: string;
  opening_ids_json: string;
  opening_paise: number;
  existing_count: number;
  undone_at: string;
};

const ids = (json: string): string[] => {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

function recordImport(
  raw: DatabaseSync,
  r: {
    id: string;
    kind: PartyKind;
    at: string;
    rows: number;
    createdIds: string[];
    openingIds: string[];
    openingPaise: number;
    existing: number;
  },
) {
  insertRows(raw, t.partyImports, [
    {
      id: r.id,
      kind: r.kind,
      at: r.at,
      rows: r.rows,
      createdIdsJson: JSON.stringify(r.createdIds),
      openingIdsJson: JSON.stringify(r.openingIds),
      openingPaise: r.openingPaise,
      existingCount: r.existing,
      undoneAt: "",
    },
  ]);
}

/** Latest customer or supplier imports first (shown with Undo) */
export function listPartyImports(
  raw: DatabaseSync,
  kind: PartyKind,
  limit = 10,
): PartyImport[] {
  return (
    raw
      .prepare(
        "SELECT * FROM party_imports WHERE kind = ? ORDER BY at DESC LIMIT ?",
      )
      .all(kind, limit) as PartyImportRow[]
  ).map((r) => ({
    id: r.id,
    kind: r.kind,
    at: r.at,
    rows: r.rows,
    created: ids(r.created_ids_json).length,
    existing: r.existing_count,
    openingPaise: r.opening_paise,
    undoneAt: r.undone_at,
  }));
}

const has = (raw: DatabaseSync, sql: string, ...p: string[]) =>
  raw.prepare(sql).get(...p) !== undefined;

function refuse(used: string[]): never {
  const list = used.slice(0, 3).join(", ");
  const more = used.length > 3 ? ` and ${used.length - 3} more` : "";
  throw new RuleError(
    `Can't undo: ${list}${more} already used since the import. Fix those one by one instead.`,
  );
}

/**
 * Takes a customer / supplier import back out, while none of them is used:
 *  - a customer must have no bill and no payment received
 *  - a supplier must have no purchase, return or payment — only the old
 *    dues this import added (unpaid, never edited)
 * All or nothing; parties that were already here are never touched.
 */
export function undoPartyImport(
  raw: DatabaseSync,
  kind: PartyKind,
  id: string,
  now = new Date(),
) {
  return writeTx(raw, () => {
    const row = raw
      .prepare("SELECT * FROM party_imports WHERE id = ? AND kind = ?")
      .get(id, kind) as PartyImportRow | undefined;
    if (!row) throw new NotFoundError("Import not found");
    if (row.undone_at) throw new RuleError("This import was already undone");
    const created = ids(row.created_ids_json);
    const opening = new Set(ids(row.opening_ids_json));
    const patch: ShopPatch = {};

    if (kind === "customers") {
      const names = new Map(
        loadCustomers(raw)
          .filter((c) => created.includes(c.id))
          .map((c) => [c.id, c.name]),
      );
      const used = [...names.keys()].filter(
        (cid) =>
          has(raw, "SELECT 1 FROM sales WHERE customer_id = ? LIMIT 1", cid) ||
          has(
            raw,
            "SELECT 1 FROM customer_payments WHERE customer_id = ? LIMIT 1",
            cid,
          ),
      );
      if (used.length) refuse(used.map((cid) => names.get(cid)!));
      for (const cid of names.keys())
        raw.prepare("DELETE FROM customers WHERE id = ?").run(cid);
      patch.customersRemoved = [...names.keys()];
    } else {
      const names = new Map(
        loadSuppliersSync(raw)
          .filter((x) => created.includes(x.id))
          .map((x) => [x.id, x.name]),
      );
      const used = [...names.keys()].filter((sid) => {
        const own = loadPurchases(raw, "supplier_id = ?", [sid]);
        return (
          own.some(
            (p) =>
              !opening.has(p.id) ||
              p.paidPaise > 0 ||
              p.revision > 1 ||
              p.status !== "active",
          ) ||
          has(
            raw,
            "SELECT 1 FROM purchase_returns WHERE supplier_id = ? LIMIT 1",
            sid,
          )
        );
      });
      if (used.length) refuse(used.map((sid) => names.get(sid)!));
      const gone: string[] = [];
      for (const sid of names.keys()) {
        for (const p of loadPurchases(raw, "supplier_id = ?", [sid])) {
          raw
            .prepare("DELETE FROM purchase_lines WHERE purchase_id = ?")
            .run(p.id);
          raw.prepare("DELETE FROM purchases WHERE id = ?").run(p.id);
          gone.push(p.id);
        }
        raw.prepare("DELETE FROM suppliers WHERE id = ?").run(sid);
      }
      patch.purchasesRemoved = gone;
    }

    raw
      .prepare("UPDATE party_imports SET undone_at = ? WHERE id = ?")
      .run(now.toISOString(), id);
    return { removed: created.length, patch };
  });
}
