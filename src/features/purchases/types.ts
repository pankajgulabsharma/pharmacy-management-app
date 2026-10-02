import type { PackUnit } from "@/features/medicines/types";
import type { BadgeTone } from "@/components/common/StatusBadge";
import type { Paise } from "@/lib/money";

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

/**
 * GST slabs selectable on a purchase line. Most medicines moved to 5%
 * in the Sept 2025 GST revision — verify each HSN with your CA.
 */
export const GST_RATES = [0, 5, 12, 18] as const;
export type GstRate = (typeof GST_RATES)[number];
export const DEFAULT_GST_RATE: GstRate = 5;

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
  /** Batches expiring within this many months are flagged (not blocked) */
  shortExpiryMonths: 6,
} as const;

/* ------------------------------------------------------------------ */
/* Domain                                                             */
/* ------------------------------------------------------------------ */

export type Supplier = {
  id: string;
  name: string;
  gstin: string;
  phone: string;
  city: string;
  /** Payment terms in days from invoice date */
  creditDays: number;
};

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

export type Purchase = {
  id: string;
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
  /** Calculated once at save time — the invoice is immutable */
  totals: PurchaseTotals;
};

/** Derived from paid vs net and due date — never stored */
export type PaymentStatus = "paid" | "partial" | "due" | "overdue";
export type PurchaseStatusFilter = "all" | PaymentStatus;

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; tone: BadgeTone }
> = {
  paid: { label: "Paid", tone: "success" },
  partial: { label: "Partially paid", tone: "caution" },
  due: { label: "Due", tone: "warning" },
  overdue: { label: "Overdue", tone: "danger" },
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
