/**
 * Old dues to a supplier brought over from the previous software (opening
 * balance). Kept as an invoice WITHOUT items, so paying it works exactly
 * like paying any invoice (part payments, overdue, supplier statement) —
 * but it never touches stock, GST, purchase totals or the GSTR-2B check.
 */
import { newId } from "../lib/id";
import { RuleError } from "../lib/errors";
import { cleanCode } from "../lib/sanitize";
import type { Supplier } from "../suppliers/types";
import { getDueDate } from "./draft";
import { PURCHASE_LIMITS, type Purchase } from "./types";

export const OPENING_INVOICE_NO = "OPENING";

/** An "opening balance" entry (no items, never posted to stock) */
export const isOpeningDue = (
  p: Pick<Purchase, "stockPosted" | "lines">,
): boolean => !p.stockPosted && p.lines.length === 0;

export type OpeningDueInput = {
  amountPaise: number;
  /** "YYYY-MM-DD" — the date the old balance is as on (default today) */
  date?: string;
  /** The old bill no. if there is one (default "OPENING") */
  ref?: string;
};

const ZERO = {
  lineCount: 0,
  totalQty: 0,
  totalFreeQty: 0,
  grossPaise: 0,
  discountPaise: 0,
  taxablePaise: 0,
  cgstPaise: 0,
  sgstPaise: 0,
  gstPaise: 0,
  roundOffPaise: 0,
};

export function buildOpeningDue(
  supplier: Pick<Supplier, "id" | "name" | "gstin" | "creditDays">,
  input: OpeningDueInput,
  now: Date,
): Purchase {
  const amount = input.amountPaise;
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_00_00_000_00)
    throw new RuleError("Enter the old balance (more than ₹0)");
  const date =
    input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
      ? input.date
      : now.toISOString().slice(0, 10);
  if (date > now.toISOString().slice(0, 10))
    throw new RuleError("The as-on date can't be in the future");
  const iso = now.toISOString();
  return {
    id: newId("pur"),
    status: "active",
    stockPosted: false,
    supplierId: supplier.id,
    supplierName: supplier.name,
    supplierGstin: supplier.gstin,
    invoiceNo:
      cleanCode(input.ref ?? "", PURCHASE_LIMITS.invoiceNoMax) ||
      OPENING_INVOICE_NO,
    invoiceDate: date,
    dueDate: getDueDate(date, supplier.creditDays),
    createdAt: iso,
    updatedAt: iso,
    revision: 1,
    lines: [],
    notes: "Opening balance — dues from before MediCare",
    paidPaise: 0,
    returnedPaise: 0,
    totals: { ...ZERO, netPaise: amount },
  };
}
