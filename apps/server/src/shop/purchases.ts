/**
 * Supplier invoices, payments and debit notes — the same rules the app used,
 * now on the server. Stock and document are saved together or not at all.
 */
import type { DatabaseSync } from "node:sqlite";
import {
  applyIssue,
  applyReceipt,
  applyReversal,
  checkReversal,
} from "@medicare/domain/inventory/ledger";
import { RuleError } from "@medicare/domain/lib/errors";
import { cleanText } from "@medicare/domain/lib/sanitize";
import { newId } from "@medicare/domain/lib/id";
import { calcTotals, getDuePaise } from "@medicare/domain/purchases/calc";
import {
  draftLineToAmountInput,
  draftToEditedPurchase,
  draftToPurchase,
} from "@medicare/domain/purchases/draft";
import { purchaseToStockReceipt } from "@medicare/domain/purchases/receipt";
import {
  buildPurchaseReturn,
  getReturnableLines,
  nextReturnNo,
} from "@medicare/domain/purchases/returns";
import {
  canCancelPurchase,
  canEditPurchase,
  canRecordPayment,
  canReturnPurchase,
  type RuleResult,
} from "@medicare/domain/purchases/rules";
import type {
  Purchase,
  PurchaseDraft,
  PurchaseReturn,
  PurchaseReturnInput,
} from "@medicare/domain/purchases/types";
import { validatePurchaseDraft } from "@medicare/domain/purchases/validation";
import type { ShopPatch } from "@medicare/domain/shop/patch";
import {
  insertPurchase,
  insertPurchaseReturn,
  loadBatches,
  loadMedicinesSync,
  loadMovements,
  loadPurchaseReturns,
  loadPurchases,
  loadSuppliersSync,
  purchaseRows,
  replacePurchase,
  saveStock,
} from "../db/mappers";
import * as t from "../db/schema";
import { updateRow, writeTx } from "../db/sync";
import { NotFoundError } from "./errors";

const enforce = (r: RuleResult) => {
  if (!r.allowed) throw new RuleError(r.reason);
};

function getPurchase(raw: DatabaseSync, id: string): Purchase {
  const [p] = loadPurchases(raw, "id = ?", [id]);
  if (!p) throw new NotFoundError("Purchase not found");
  return p;
}

/** Can this invoice's stock still be taken back? (goods not yet sold) */
function ruleContext(raw: DatabaseSync, p: Purchase) {
  return {
    returnCount: (
      raw
        .prepare(
          "SELECT count(*) n FROM purchase_returns WHERE purchase_id = ?",
        )
        .get(p.id) as { n: number }
    ).n,
    stockReversible:
      !p.stockPosted ||
      checkReversal(
        loadBatches(raw),
        loadMovements(raw, "ref_id = ?", [p.id]),
        p.id,
      ).length === 0,
  };
}

/**
 * Checks the typed form exactly like the screen does, and fills medicine
 * details from the master list (never trusts names/units sent by the app).
 */
function checkDraft(
  raw: DatabaseSync,
  draft: PurchaseDraft,
  now: Date,
  editing: Purchase | null,
) {
  const medicines = new Map(loadMedicinesSync(raw).map((m) => [m.id, m]));
  const lines = draft.lines.map((l, i) => {
    const m = medicines.get(l.medicineId);
    if (!m) throw new RuleError(`Line ${i + 1}: unknown medicine`);
    return {
      ...l,
      // New invoice: the server numbers its lines (never trusts ids from the app);
      // an edit keeps the existing line ids
      key: editing ? l.key : newId("pl"),
      medicineName: m.name,
      brand: m.brand,
      hsn: m.hsn,
      unit: m.unit,
      unitsPerStrip: m.unitsPerStrip,
    };
  });
  const clean: PurchaseDraft = { ...draft, lines };
  const suppliers = loadSuppliersSync(raw);
  const netPaise = calcTotals(lines.map(draftLineToAmountInput)).netPaise;
  const errors = validatePurchaseDraft(clean, {
    suppliers,
    existing: loadPurchases(raw),
    today: now,
    netPaise,
    editing,
  });
  const header = Object.values(errors.header).find(Boolean);
  if (header) throw new RuleError(header);
  for (const [i, l] of lines.entries()) {
    const e = errors.lines[l.key];
    const first = e && Object.entries(e).find(([, msg]) => msg);
    if (first)
      throw new RuleError(
        `Line ${i + 1} (${l.medicineName}): ${first[0]} — ${first[1]}`,
      );
  }
  const supplier = suppliers.find((s) => s.id === draft.supplierId)!;
  return { draft: clean, supplier, knownIds: new Set(medicines.keys()) };
}

export function addPurchase(
  raw: DatabaseSync,
  input: PurchaseDraft,
  now = new Date(),
) {
  return writeTx(raw, () => {
    const { draft, supplier, knownIds } = checkDraft(raw, input, now, null);
    const purchase = draftToPurchase(draft, supplier, now);
    const before = loadBatches(raw);
    const receipt = purchaseToStockReceipt(purchase);
    const r = applyReceipt(before, receipt, knownIds);
    const saved = saveStock(raw, before, r.batches, r.movements);
    insertPurchase(raw, purchase);
    const packs = receipt.lines.reduce((a, l) => a + l.packs, 0);
    return {
      purchase,
      packs,
      patch: { purchases: [purchase], ...saved } satisfies ShopPatch,
    };
  });
}

export function updatePurchase(
  raw: DatabaseSync,
  id: string,
  input: PurchaseDraft,
  revision: number,
  now = new Date(),
) {
  return writeTx(raw, () => {
    const current = getPurchase(raw, id);
    if (current.revision !== revision)
      throw new RuleError(
        "This invoice was changed elsewhere — reopen it and try again",
      );
    enforce(canEditPurchase(current, ruleContext(raw, current)));
    const { draft, supplier, knownIds } = checkDraft(raw, input, now, current);
    const next = draftToEditedPurchase(draft, supplier, current, now);
    const before = loadBatches(raw);
    const reversed = applyReversal(
      before,
      loadMovements(raw, "ref_id = ?", [id]),
      id,
      `Edit of ${current.invoiceNo} (rev ${next.revision})`,
      now,
    );
    const received = applyReceipt(
      reversed.batches,
      purchaseToStockReceipt(next),
      knownIds,
    );
    const movements = [...reversed.movements, ...received.movements];
    const saved = saveStock(raw, before, received.batches, movements);
    replacePurchase(raw, next);
    return {
      purchase: next,
      patch: { purchases: [next], ...saved } satisfies ShopPatch,
    };
  });
}

export function cancelPurchase(
  raw: DatabaseSync,
  id: string,
  reason: string,
  now = new Date(),
) {
  return writeTx(raw, () => {
    const current = getPurchase(raw, id);
    enforce(canCancelPurchase(current, ruleContext(raw, current)));
    const why = cleanText(reason, 200);
    if (!why) throw new RuleError("Please give a reason for cancelling");
    let patch: ShopPatch = {};
    if (current.stockPosted) {
      const before = loadBatches(raw);
      const r = applyReversal(
        before,
        loadMovements(raw, "ref_id = ?", [id]),
        id,
        `Cancelled ${current.invoiceNo}: ${why}`,
        now,
      );
      patch = saveStock(raw, before, r.batches, r.movements);
    }
    const iso = now.toISOString();
    const next: Purchase = {
      ...current,
      status: "cancelled",
      cancelledAt: iso,
      cancelReason: why,
      updatedAt: iso,
    };
    updateRow(raw, t.purchases, "id", purchaseRows(next).purchase);
    return {
      purchase: next,
      patch: { ...patch, purchases: [next] } satisfies ShopPatch,
    };
  });
}

export function recordSupplierPayment(
  raw: DatabaseSync,
  id: string,
  amountPaise: number,
  now = new Date(),
) {
  return writeTx(raw, () => {
    if (!Number.isInteger(amountPaise) || amountPaise <= 0)
      throw new RuleError("Enter a valid amount");
    const current = getPurchase(raw, id);
    enforce(canRecordPayment(current));
    if (amountPaise > getDuePaise(current))
      throw new RuleError("Amount is more than the balance");
    const next: Purchase = {
      ...current,
      paidPaise: current.paidPaise + amountPaise,
      updatedAt: now.toISOString(),
    };
    updateRow(raw, t.purchases, "id", {
      id,
      paidPaise: next.paidPaise,
      updatedAt: next.updatedAt,
    });
    return { purchase: next, patch: { purchases: [next] } satisfies ShopPatch };
  });
}

export function createPurchaseReturn(
  raw: DatabaseSync,
  input: PurchaseReturnInput,
  now = new Date(),
) {
  return writeTx(raw, () => {
    const purchase = getPurchase(raw, input.purchaseId);
    enforce(canReturnPurchase(purchase));
    const returns = loadPurchaseReturns(raw);
    const before = loadBatches(raw);
    const { ret, issue } = buildPurchaseReturn(
      purchase,
      input,
      getReturnableLines(purchase, returns, before),
      nextReturnNo(returns),
      now,
    );
    const r = applyIssue(before, {
      refId: ret.id,
      type: "purchase_return",
      note: `Return ${ret.returnNo} · ${ret.supplierName}`,
      at: now,
      lines: issue,
    });
    const saved = saveStock(raw, before, r.batches, r.movements);
    insertPurchaseReturn(raw, ret);
    const next: Purchase = {
      ...purchase,
      returnedPaise: purchase.returnedPaise + ret.totalPaise,
      updatedAt: now.toISOString(),
    };
    updateRow(raw, t.purchases, "id", {
      id: next.id,
      returnedPaise: next.returnedPaise,
      updatedAt: next.updatedAt,
    });
    return {
      ret: ret as PurchaseReturn,
      patch: {
        purchaseReturns: [ret],
        purchases: [next],
        ...saved,
      } satisfies ShopPatch,
    };
  });
}
