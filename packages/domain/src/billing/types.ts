import type { PackUnit } from "../medicines/types";
import type { GstRate } from "../lib/gst";
import type { Paise } from "../lib/money";

/* ------------------------------------------------------------------ */
/* Limits & options                                                   */
/* ------------------------------------------------------------------ */

export const BILLING_LIMITS = {
  maxLines: 100,
  maxQty: 9999,
  customerMax: 60,
  referenceMax: 40,
  notesMax: 200,
  /** Held bills kept at once */
  maxHeld: 20,
} as const;

/** Allowed line discounts — a fixed list stops typos like 50% */
export const DISCOUNT_OPTIONS = [0, 5, 10, 15, 20] as const;

export type PaymentMethod =
  "cash" | "upi" | "card" | "wallet" | "udhaar" | "split";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  wallet: "Wallet",
  udhaar: "Udhaar",
  split: "Split",
};

/* ------------------------------------------------------------------ */
/* Cart (what the cashier is building)                                */
/* ------------------------------------------------------------------ */

/**
 * The cart only says WHAT and HOW MUCH. Which batches it comes from is
 * decided by FEFO (first-expiry-first-out) from live stock.
 */
export type CartLine = {
  lineId: string;
  medicineId: string;
  /** Whole packs (strips / bottles / boxes). Always 0 for LSE medicines. */
  qtyStrip: number;
  /** Loose units (tablets). Only for medicines that allow loose sale. */
  qtyLoose: number;
  discountPercent: number;
};

/** Raw payment inputs, exactly as typed */
export type PaymentDraft = {
  method: PaymentMethod;
  /** Cash received */
  received: string;
  /** UPI UTR / card approval code (optional) */
  reference: string;
  split: { cash: string; upi: string; card: string };
};

export const EMPTY_PAYMENT: PaymentDraft = {
  method: "cash",
  received: "",
  reference: "",
  split: { cash: "", upi: "", card: "" },
};

/* ------------------------------------------------------------------ */
/* Saved sale                                                         */
/* ------------------------------------------------------------------ */

/** Part of a line taken from one batch */
export type BatchAllocation = {
  batchId: string;
  batchNo: string;
  expiry: string;
  /** Whole packs taken from this batch */
  qtyStrip: number;
  /** Loose units sold from this batch */
  qtyLoose: number;
  /** Strips opened to sell loose units (they become loose stock) */
  breakStrips: number;
  /** Selling price per pack, incl. GST — never above this batch's MRP */
  ratePaise: Paise;
  mrpPaise: Paise;
  /**
   * Landed purchase cost per pack AT THE TIME OF SALE (snapshot), so
   * profit reports stay correct even if the batch cost changes later.
   */
  costPaise: Paise;
};

export type LineAmounts = {
  grossPaise: Paise;
  discountPaise: Paise;
  /** What the customer pays for this line (GST included) */
  amountPaise: Paise;
  taxablePaise: Paise;
  gstPaise: Paise;
};

export type SaleLine = LineAmounts & {
  id: string;
  medicineId: string;
  medicineName: string;
  brand: string;
  hsn: string;
  unit: PackUnit;
  unitsPerStrip: number;
  gstPercent: GstRate;
  discountPercent: number;
  qtyStrip: number;
  qtyLoose: number;
  allocations: BatchAllocation[];
};

export type SaleTotals = {
  itemCount: number;
  grossPaise: Paise;
  discountPaise: Paise;
  taxablePaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  gstPaise: Paise;
  roundOffPaise: Paise;
  netPaise: Paise;
};

export type SalePayment = {
  method: PaymentMethod;
  /** Cash handed over by the customer (cash only) */
  receivedPaise: Paise;
  changePaise: Paise;
  split: { cashPaise: Paise; upiPaise: Paise; cardPaise: Paise } | null;
  reference: string;
};

export type Sale = {
  id: string;
  /** Sequential, e.g. "INV-0042" */
  billNo: string;
  /** ISO timestamp */
  createdAt: string;
  customerName: string;
  doctor: string;
  counter: string;
  lines: SaleLine[];
  totals: SaleTotals;
  payment: SalePayment;
  /** "udhaar" = customer will pay later */
  status: "paid" | "udhaar";
  /** Total refunded through sales returns */
  returnedPaise: Paise;
  /** Customer account (khata) — always set for udhaar bills */
  customerId?: string | null;
  /**
   * History imported from before this app tracked stock (demo: older
   * sales). Counted in reports, but never moved stock and can't be returned.
   */
  imported?: boolean;
};

/** What the billing screen submits */
export type SaleInput = {
  cart: CartLine[];
  customerName: string;
  /** Customer account; REQUIRED when paying by udhaar */
  customerId?: string | null;
  doctor: string;
  counter: string;
  payment: PaymentDraft;
};

/* ------------------------------------------------------------------ */
/* Held bills                                                         */
/* ------------------------------------------------------------------ */

/** A parked cart. Stock is NOT reserved — it is re-checked on resume. */
export type HeldBill = {
  id: string;
  heldAt: string;
  customerName: string;
  doctor: string;
  counter: string;
  lines: CartLine[];
};

/* ------------------------------------------------------------------ */
/* Sales return                                                       */
/* ------------------------------------------------------------------ */

export const SALE_RETURN_REASONS = [
  "Wrong medicine",
  "Excess quantity",
  "Doctor changed prescription",
  "Expired / near expiry",
  "Customer request",
  "Other",
] as const;

export type RefundMode = "cash" | "upi" | "udhaar_adjust";

export const REFUND_MODE_LABELS: Record<RefundMode, string> = {
  cash: "Cash",
  upi: "UPI",
  udhaar_adjust: "Adjust in udhaar",
};

export type SaleReturnLine = {
  id: string;
  saleLineId: string;
  medicineId: string;
  medicineName: string;
  unit: PackUnit;
  unitsPerStrip: number;
  qtyStrip: number;
  qtyLoose: number;
  amountPaise: Paise;
  /** Where the goods went back (same batches they were sold from) */
  batches: { batchId: string; qtyStrip: number; qtyLoose: number }[];
};

export type SaleReturn = {
  id: string;
  /** Sequential, e.g. "SR-0003" */
  returnNo: string;
  saleId: string;
  billNo: string;
  customerName: string;
  createdAt: string;
  reason: string;
  refundMode: RefundMode;
  notes: string;
  lines: SaleReturnLine[];
  roundOffPaise: Paise;
  /** Amount given back to the customer (rounded to the rupee) */
  refundPaise: Paise;
};

export type SaleReturnInput = {
  saleId: string;
  reason: string;
  refundMode: RefundMode;
  notes: string;
  lines: { saleLineId: string; qtyStrip: number; qtyLoose: number }[];
};
