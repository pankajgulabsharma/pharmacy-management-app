import type { PackUnit } from "../medicines/types";
import type { Tone } from "../lib/tone";
import type { Paise } from "../lib/money";

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

export { GST_RATES, DEFAULT_GST_RATE, type GstRate } from "../lib/gst";
import type { GstRate } from "../lib/gst";

export const PURCHASE_LIMITS = {
  invoiceNoMax: 30,
  batchNoMax: 20,
  notesMax: 300,
  maxLines: 200,
  maxQty: 100_000,
  /** ₹1,00,000 per pack */
  maxRatePaise: 10_000_000,
  /** Invoice must not be older than this */
  maxInvoiceAgeDays: 365,
} as const;

/* ------------------------------------------------------------------ */
/* Domain                                                             */
/* ------------------------------------------------------------------ */

export type { Supplier } from "../suppliers/types";

export type PurchaseLine = {
  id: string;
  medicineId: string;
  /** Snapshot of master data at purchase time (invoice is a legal record) */
  medicineName: string;
  brand: string;
  hsn: string;
  unit: PackUnit;
  unitsPerStrip: number;
  batchNo: string;
  /** "MM/YY" */
  expiry: string;
  /** Billed quantity in packs */
  qty: number;
  /** Scheme / free packs (no cost, still added to stock) */
  freeQty: number;
  /** Purchase rate per pack, excluding GST */
  ratePaise: Paise;
  /** MRP per pack, including GST */
  mrpPaise: Paise;
  discountPercent: number;
  gstPercent: GstRate;
};

export type PurchaseTotals = {
  lineCount: number;
  totalQty: number;
  totalFreeQty: number;
  grossPaise: Paise;
  discountPaise: Paise;
  taxablePaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  gstPaise: Paise;
  roundOffPaise: Paise;
  netPaise: Paise;
};

export type PurchaseStatus = "active" | "cancelled";

export type Purchase = {
  id: string;
  status: PurchaseStatus;
  /**
   * True when this invoice's goods were added to inventory by the app.
   * Older history imported without stock is false and is read-only.
   */
  stockPosted: boolean;
  supplierId: string;
  supplierName: string;
  supplierGstin: string;
  invoiceNo: string;
  /** "YYYY-MM-DD" */
  invoiceDate: string;
  /** "YYYY-MM-DD" — invoiceDate + supplier credit days */
  dueDate: string;
  /** ISO timestamp when entered */
  createdAt: string;
  lines: PurchaseLine[];
  notes: string;
  paidPaise: Paise;
  /** Total of debit notes (returns) raised against this invoice */
  returnedPaise: Paise;
  /** Calculated at save time; recalculated only by an edit */
  totals: PurchaseTotals;
  /** Starts at 1, +1 on every edit */
  revision: number;
  /** ISO timestamp of the last change */
  updatedAt: string;
  cancelledAt?: string;
  cancelReason?: string;
};

/** Derived from paid vs net and due date — never stored */
export type PaymentStatus =
  "paid" | "partial" | "due" | "overdue" | "cancelled";
export type PurchaseStatusFilter = "all" | PaymentStatus;

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; tone: Tone }
> = {
  paid: { label: "Paid", tone: "success" },
  partial: { label: "Partially paid", tone: "caution" },
  due: { label: "Due", tone: "warning" },
  overdue: { label: "Overdue", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/* ------------------------------------------------------------------ */
/* Purchase return (debit note)                                       */
/* ------------------------------------------------------------------ */

export const RETURN_REASONS = {
  expired: "Expired",
  near_expiry: "Near expiry",
  damaged: "Damaged / broken",
  wrong_item: "Wrong item supplied",
  excess: "Excess / not ordered",
  other: "Other",
} as const;

export type ReturnReason = keyof typeof RETURN_REASONS;

export const CANCEL_REASONS = [
  "Wrong supplier selected",
  "Duplicate entry",
  "Wrong quantities / rates — will re-enter",
  "Goods not received",
  "Other",
] as const;

export type PurchaseReturnLine = {
  id: string;
  /** Line of the original invoice */
  purchaseLineId: string;
  medicineId: string;
  medicineName: string;
  brand: string;
  unit: PackUnit;
  unitsPerStrip: number;
  batchNo: string;
  expiry: string;
  /** Packs returned (loose units for LSE medicines) */
  qty: number;
  /** Credit per pack = landed cost per pack of the original line (incl. GST) */
  ratePaise: Paise;
  gstPercent: GstRate;
  /** qty × rate, incl. GST */
  amountPaise: Paise;
  /** GST part of amountPaise */
  gstPaise: Paise;
};

export type PurchaseReturn = {
  id: string;
  /** Sequential, e.g. "DN-0007" */
  returnNo: string;
  purchaseId: string;
  invoiceNo: string;
  supplierId: string;
  supplierName: string;
  supplierGstin: string;
  /** "YYYY-MM-DD" */
  date: string;
  reason: ReturnReason;
  notes: string;
  lines: PurchaseReturnLine[];
  totalQty: number;
  /** Incl. GST — reduces what we owe the supplier */
  totalPaise: Paise;
  gstPaise: Paise;
  /** ISO timestamp */
  createdAt: string;
};

/** What the return form submits */
export type PurchaseReturnInput = {
  purchaseId: string;
  date: string;
  reason: ReturnReason;
  notes: string;
  lines: { purchaseLineId: string; qty: number }[];
};

/* ------------------------------------------------------------------ */
/* Form drafts — raw strings exactly as typed                          */
/* ------------------------------------------------------------------ */

export type PurchaseLineDraft = {
  key: string;
  medicineId: string;
  medicineName: string;
  brand: string;
  hsn: string;
  unit: PackUnit;
  unitsPerStrip: number;
  batchNo: string;
  expiry: string;
  qty: string;
  freeQty: string;
  rate: string;
  mrp: string;
  discountPercent: string;
  gstPercent: GstRate;
};

export type PurchaseLineField =
  | "batchNo"
  | "expiry"
  | "qty"
  | "freeQty"
  | "rate"
  | "mrp"
  | "discountPercent"
  | "gstPercent";

export type PurchaseDraft = {
  supplierId: string;
  invoiceNo: string;
  invoiceDate: string;
  notes: string;
  paid: string;
  lines: PurchaseLineDraft[];
};

export type PurchaseHeaderField = Exclude<keyof PurchaseDraft, "lines">;
