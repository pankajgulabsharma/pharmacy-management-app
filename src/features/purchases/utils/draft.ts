import type { Medicine } from "@/features/medicines/types";
import { addDays, parseISODate, toISODate } from "@/lib/date";
import { newId } from "@/lib/id";
import { paiseToInput, parseRupees, rupeesToPaise } from "@/lib/money";
import { cleanCode, cleanText, toNumberOrZero } from "@/lib/sanitize";
import {
  PURCHASE_LIMITS,
  type Purchase,
  type PurchaseDraft,
  type PurchaseLine,
  type PurchaseLineDraft,
  type Supplier,
} from "../types";
import { calcTotals, type LineAmountInput } from "./calc";

export function createEmptyDraft(today: Date): PurchaseDraft {
  return {
    supplierId: "",
    invoiceNo: "",
    invoiceDate: toISODate(today),
    notes: "",
    paid: "",
    lines: [],
  };
}

/** New line pre-filled from the medicine master */
export function createLineFromMedicine(m: Medicine): PurchaseLineDraft {
  return {
    key: newId("pl"),
    medicineId: m.id,
    medicineName: m.name,
    brand: m.brand,
    hsn: m.hsn,
    unit: m.unit,
    unitsPerStrip: m.unitsPerStrip,
    batchNo: "",
    expiry: "",
    qty: "",
    freeQty: "",
    rate: "",
    mrp: m.mrp > 0 ? paiseToInput(rupeesToPaise(m.mrp)) : "",
    discountPercent: "",
    gstPercent: m.gstPercent,
  };
}

/** Lenient conversion for live totals while the user is still typing */
export function draftLineToAmountInput(d: PurchaseLineDraft): LineAmountInput {
  return {
    qty: toNumberOrZero(d.qty),
    freeQty: toNumberOrZero(d.freeQty),
    ratePaise: parseRupees(d.rate) ?? 0,
    discountPercent: toNumberOrZero(d.discountPercent),
    gstPercent: d.gstPercent,
  };
}

export function isDraftDirty(d: PurchaseDraft): boolean {
  return (
    d.lines.length > 0 ||
    d.supplierId !== "" ||
    d.invoiceNo.trim() !== "" ||
    d.notes.trim() !== "" ||
    d.paid.trim() !== ""
  );
}

export function getDueDate(invoiceDate: string, creditDays: number): string {
  const d = parseISODate(invoiceDate);
  return d ? toISODate(addDays(d, creditDays)) : "";
}

function draftLineToLine(d: PurchaseLineDraft): PurchaseLine {
  return {
    // The draft key is the line id, so lines keep their id across edits
    id: d.key,
    medicineId: d.medicineId,
    medicineName: d.medicineName,
    brand: d.brand,
    hsn: d.hsn,
    unit: d.unit,
    unitsPerStrip: d.unitsPerStrip,
    batchNo: cleanCode(d.batchNo, PURCHASE_LIMITS.batchNoMax),
    expiry: d.expiry.trim(),
    qty: Number(d.qty),
    freeQty: d.freeQty.trim() === "" ? 0 : Number(d.freeQty),
    ratePaise: parseRupees(d.rate) ?? 0,
    mrpPaise: parseRupees(d.mrp) ?? 0,
    discountPercent:
      d.discountPercent.trim() === "" ? 0 : Number(d.discountPercent),
    gstPercent: d.gstPercent,
  };
}

/**
 * Builds the immutable Purchase record.
 * Call only after validatePurchaseDraft() returned no errors.
 */
export function draftToPurchase(
  draft: PurchaseDraft,
  supplier: Supplier,
  now: Date,
): Purchase {
  const lines = draft.lines.map(draftLineToLine);
  const totals = calcTotals(lines);
  const paid = parseRupees(draft.paid) ?? 0;
  const iso = now.toISOString();

  return {
    id: newId("pur"),
    status: "active",
    stockPosted: true,
    supplierId: supplier.id,
    supplierName: supplier.name,
    supplierGstin: supplier.gstin,
    invoiceNo: cleanCode(draft.invoiceNo, PURCHASE_LIMITS.invoiceNoMax),
    invoiceDate: draft.invoiceDate,
    dueDate: getDueDate(draft.invoiceDate, supplier.creditDays),
    createdAt: iso,
    updatedAt: iso,
    revision: 1,
    lines,
    notes: cleanText(draft.notes, PURCHASE_LIMITS.notesMax),
    paidPaise: Math.min(paid, totals.netPaise),
    returnedPaise: 0,
    totals,
  };
}

/**
 * Applies an edited draft to an existing invoice. Identity, payments and
 * history (id, createdAt, paid, returns) are kept; revision goes up by 1.
 */
export function draftToEditedPurchase(
  draft: PurchaseDraft,
  supplier: Supplier,
  existing: Purchase,
  now: Date,
): Purchase {
  const fresh = draftToPurchase(draft, supplier, now);
  return {
    ...fresh,
    id: existing.id,
    createdAt: existing.createdAt,
    stockPosted: existing.stockPosted,
    paidPaise: existing.paidPaise,
    returnedPaise: existing.returnedPaise,
    revision: existing.revision + 1,
  };
}

/** Saved invoice → editable draft (exact inverse of draftToPurchase) */
export function purchaseToDraft(p: Purchase): PurchaseDraft {
  return {
    supplierId: p.supplierId,
    invoiceNo: p.invoiceNo,
    invoiceDate: p.invoiceDate,
    notes: p.notes,
    paid: "",
    lines: p.lines.map((l): PurchaseLineDraft => ({
      key: l.id,
      medicineId: l.medicineId,
      medicineName: l.medicineName,
      brand: l.brand,
      hsn: l.hsn,
      unit: l.unit,
      unitsPerStrip: l.unitsPerStrip,
      batchNo: l.batchNo,
      expiry: l.expiry,
      qty: String(l.qty),
      freeQty: l.freeQty > 0 ? String(l.freeQty) : "",
      rate: paiseToInput(l.ratePaise),
      mrp: paiseToInput(l.mrpPaise),
      discountPercent: l.discountPercent > 0 ? String(l.discountPercent) : "",
      gstPercent: l.gstPercent,
    })),
  };
}
