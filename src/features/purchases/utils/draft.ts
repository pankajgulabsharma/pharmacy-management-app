import type { Medicine } from "@/features/medicines/types";
import { addDays, parseISODate, toISODate } from "@/lib/date";
import { newId } from "@/lib/id";
import { paiseToInput, parseRupees, rupeesToPaise } from "@/lib/money";
import { cleanCode, cleanText, toNumberOrZero } from "@/lib/sanitize";
import {
  DEFAULT_GST_RATE,
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
    gstPercent: DEFAULT_GST_RATE,
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
    id: newId("pl"),
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

  return {
    id: newId("pur"),
    supplierId: supplier.id,
    supplierName: supplier.name,
    supplierGstin: supplier.gstin,
    invoiceNo: cleanCode(draft.invoiceNo, PURCHASE_LIMITS.invoiceNoMax),
    invoiceDate: draft.invoiceDate,
    dueDate: getDueDate(draft.invoiceDate, supplier.creditDays),
    createdAt: now.toISOString(),
    lines,
    notes: cleanText(draft.notes, PURCHASE_LIMITS.notesMax),
    paidPaise: Math.min(paid, totals.netPaise),
    totals,
  };
}
