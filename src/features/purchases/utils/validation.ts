import { diffInDays, parseISODate } from "@/lib/date";
import { isExpiryPast, isValidExpiry } from "@/lib/expiry";
import { formatPaise, parseRupees, type Paise } from "@/lib/money";
import {
  GST_RATES,
  PURCHASE_LIMITS,
  type Purchase,
  type PurchaseDraft,
  type PurchaseHeaderField,
  type PurchaseLineDraft,
  type PurchaseLineField,
  type Supplier,
} from "../types";
import { calcLine } from "./calc";
import { draftLineToAmountInput } from "./draft";

export type HeaderErrors = Partial<
  Record<PurchaseHeaderField | "lines", string>
>;
export type LineErrors = Partial<Record<PurchaseLineField, string>>;

export type PurchaseErrors = {
  header: HeaderErrors;
  lines: Record<string, LineErrors>;
};

export const NO_ERRORS: PurchaseErrors = { header: {}, lines: {} };

/** Letters/digits first, then letters, digits, "-" or "/" */
const CODE_RE = /^[A-Z0-9][A-Z0-9\-/]*$/i;
const INT_RE = /^\d+$/;
const PERCENT_RE = /^\d{1,3}(\.\d{1,2})?$/;

export function hasErrors(e: PurchaseErrors): boolean {
  return (
    Object.keys(e.header).length > 0 ||
    Object.values(e.lines).some((l) => Object.keys(l).length > 0)
  );
}

function validateLine(l: PurchaseLineDraft, today: Date): LineErrors {
  const e: LineErrors = {};

  const batch = l.batchNo.trim();
  if (!batch) e.batchNo = "Required";
  else if (!CODE_RE.test(batch)) e.batchNo = "Only A–Z, 0–9, - and /";
  else if (batch.length > PURCHASE_LIMITS.batchNoMax) e.batchNo = "Too long";

  if (!l.expiry.trim()) e.expiry = "Required";
  else if (!isValidExpiry(l.expiry)) e.expiry = "Use MM/YY";
  else if (isExpiryPast(l.expiry, today)) e.expiry = "Already expired";

  if (!INT_RE.test(l.qty) || Number(l.qty) < 1) e.qty = "Min 1";
  else if (Number(l.qty) > PURCHASE_LIMITS.maxQty) e.qty = "Too large";

  if (l.freeQty.trim() !== "") {
    if (!INT_RE.test(l.freeQty)) e.freeQty = "Whole number";
    else if (Number(l.freeQty) > PURCHASE_LIMITS.maxQty)
      e.freeQty = "Too large";
  }

  const rate = parseRupees(l.rate);
  if (rate === null || rate <= 0) e.rate = "Enter rate";
  else if (rate > PURCHASE_LIMITS.maxRatePaise) e.rate = "Too large";

  const mrp = parseRupees(l.mrp);
  if (mrp === null || mrp <= 0) e.mrp = "Enter MRP";
  else if (mrp > PURCHASE_LIMITS.maxRatePaise) e.mrp = "Too large";

  if (l.discountPercent.trim() !== "") {
    if (
      !PERCENT_RE.test(l.discountPercent) ||
      Number(l.discountPercent) > 100
    ) {
      e.discountPercent = "0–100";
    }
  }

  if (!(GST_RATES as readonly number[]).includes(l.gstPercent)) {
    e.gstPercent = "Invalid";
  }

  // Cost per pack incl. GST must not exceed MRP (MRP is GST-inclusive)
  if (!e.rate && !e.mrp && !e.qty && !e.discountPercent && rate && mrp) {
    const { costPerPackPaise } = calcLine(draftLineToAmountInput(l));
    if (costPerPackPaise > mrp) {
      e.rate = `Cost ₹${formatPaise(costPerPackPaise)} > MRP`;
    }
  }

  return e;
}

type Context = {
  suppliers: readonly Supplier[];
  existing: readonly Purchase[];
  today: Date;
  netPaise: Paise;
};

export function validatePurchaseDraft(
  draft: PurchaseDraft,
  { suppliers, existing, today, netPaise }: Context,
): PurchaseErrors {
  const header: HeaderErrors = {};
  const lines: Record<string, LineErrors> = {};

  /* Supplier */
  const supplier = suppliers.find((s) => s.id === draft.supplierId);
  if (!supplier) header.supplierId = "Select a supplier";

  /* Invoice number — unique per supplier */
  const invoiceNo = draft.invoiceNo.trim();
  if (!invoiceNo) header.invoiceNo = "Required";
  else if (!CODE_RE.test(invoiceNo))
    header.invoiceNo = "Only A–Z, 0–9, - and /";
  else if (invoiceNo.length > PURCHASE_LIMITS.invoiceNoMax)
    header.invoiceNo = "Too long";
  else if (supplier) {
    const needle = invoiceNo.toUpperCase();
    const duplicate = existing.some(
      (p) =>
        p.supplierId === supplier.id && p.invoiceNo.toUpperCase() === needle,
    );
    if (duplicate) header.invoiceNo = "Already entered for this supplier";
  }

  /* Invoice date — not in the future, not too old */
  const invoiceDate = parseISODate(draft.invoiceDate);
  if (!invoiceDate) header.invoiceDate = "Enter a valid date";
  else {
    const age = diffInDays(today, invoiceDate);
    if (age < 0) header.invoiceDate = "Can't be in the future";
    else if (age > PURCHASE_LIMITS.maxInvoiceAgeDays)
      header.invoiceDate = "Older than 1 year";
  }

  /* Paid amount */
  if (draft.paid.trim() !== "") {
    const paid = parseRupees(draft.paid);
    if (paid === null) header.paid = "Enter a valid amount";
    else if (paid > netPaise) header.paid = "More than invoice total";
  }

  /* Lines */
  if (draft.lines.length === 0) header.lines = "Add at least one medicine";
  else if (draft.lines.length > PURCHASE_LIMITS.maxLines) {
    header.lines = `Max ${PURCHASE_LIMITS.maxLines} items per invoice`;
  }

  const seenBatches = new Set<string>();
  for (const l of draft.lines) {
    const e = validateLine(l, today);

    // Same medicine + batch twice is almost always a data-entry mistake
    const batchKey = `${l.medicineId}|${l.batchNo.trim().toUpperCase()}`;
    if (!e.batchNo) {
      if (seenBatches.has(batchKey)) e.batchNo = "Duplicate batch";
      seenBatches.add(batchKey);
    }

    if (Object.keys(e).length > 0) lines[l.key] = e;
  }

  return { header, lines };
}

/** Payment against an existing purchase */
export function validatePayment(input: string, duePaise: Paise): string | null {
  const amount = parseRupees(input);
  if (amount === null || amount <= 0) return "Enter a valid amount";
  if (amount > duePaise) return `Max ₹${formatPaise(duePaise)}`;
  return null;
}
