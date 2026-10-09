/**
 * Building and validating a sale — pure, re-checked on save even though
 * the screen validates too (never trust the caller).
 */
import { scheduleRule } from "../medicines/schedule";
import type { StockBatch, StockChangeLine } from "../inventory/types";
import type { Medicine } from "../medicines/types";
import { newId } from "../lib/id";
import { checkGstin } from "../lib/gstin";
import { DEFAULT_BILL_PREFIX, nextDocNo } from "../lib/docNo";
import { parseRupees, type Paise } from "../lib/money";
import { cleanText } from "../lib/sanitize";
import {
  BILLING_LIMITS,
  DISCOUNT_OPTIONS,
  PAYMENT_METHOD_LABELS,
  type CartLine,
  type PaymentDraft,
  type Sale,
  type SaleInput,
  type SaleLine,
  type SalePayment,
} from "./types";
import {
  allocateFefo,
  allocationDelta,
  sellableBatches,
  unitsPerPack,
} from "./allocate";
import { calcSaleTotals, priceLine } from "./pricing";

export class SaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleError";
  }
}

const WALK_IN = "Walk-in customer";

/** "INV/26-27/0001", … — this financial year's next bill number (lib/docNo) */
export function nextBillNo(
  sales: readonly Pick<Sale, "billNo" | "createdAt">[],
  prefix = DEFAULT_BILL_PREFIX,
  now = new Date(),
): string {
  return nextDocNo(
    sales.map((s) => ({ no: s.billNo, at: s.createdAt })),
    prefix,
    now,
  );
}

/** Quantity rules for one cart line against its medicine */
export function validateCartLine(
  line: CartLine,
  m: Medicine | undefined,
): string | null {
  if (!m) return "Medicine no longer exists";
  if (m.status !== "active") return `${m.name} is inactive`;
  const { qtyStrip, qtyLoose } = line;
  if (![qtyStrip, qtyLoose].every((n) => Number.isInteger(n) && n >= 0)) {
    return `${m.name}: quantity must be a whole number`;
  }
  if (qtyStrip > BILLING_LIMITS.maxQty || qtyLoose > BILLING_LIMITS.maxQty) {
    return `${m.name}: quantity too large`;
  }
  if (qtyStrip + qtyLoose === 0) return `${m.name}: quantity is 0`;
  if (m.unit === "LSE" && qtyStrip > 0) return `${m.name} is sold loose only`;
  if (qtyLoose > 0 && m.unit !== "LSE" && !(m.unit === "STP" && m.allowLoose)) {
    return `${m.name} can't be sold loose`;
  }
  if (!(DISCOUNT_OPTIONS as readonly number[]).includes(line.discountPercent)) {
    return `${m.name}: invalid discount`;
  }
  return null;
}

/** Turns one cart line into a priced sale line taken from FEFO batches */
export function buildSaleLine(
  line: CartLine,
  m: Medicine,
  batches: readonly StockBatch[],
  now: Date,
): { saleLine: SaleLine; change: StockChangeLine[] } {
  const sellable = sellableBatches(batches, m.id, now);
  const { allocations, shortStrip, shortLoose } = allocateFefo(
    sellable,
    m,
    line.qtyStrip,
    line.qtyLoose,
  );
  if (shortStrip > 0 || shortLoose > 0) {
    throw new SaleError(
      `${m.name}: not enough stock (expired batches are never sold)`,
    );
  }
  const ups = unitsPerPack(m);
  return {
    saleLine: {
      id: newId("sl"),
      medicineId: m.id,
      medicineName: m.name,
      brand: m.brand,
      hsn: m.hsn,
      unit: m.unit,
      unitsPerStrip: ups,
      gstPercent: m.gstPercent,
      discountPercent: line.discountPercent,
      qtyStrip: line.qtyStrip,
      qtyLoose: line.qtyLoose,
      allocations,
      ...(m.schedule ? { schedule: m.schedule } : {}),
      ...priceLine(allocations, ups, line.discountPercent, m.gstPercent),
    },
    change: allocations.map((a) => allocationDelta(a, ups)),
  };
}

const money = (s: string): Paise => parseRupees(s) ?? -1;

/** Payment rules. Returns an error message, or null when OK. */
export function validatePayment(
  p: PaymentDraft,
  netPaise: Paise,
  customerName: string,
  customerId: string | null = null,
): string | null {
  switch (p.method) {
    case "cash": {
      // Nothing typed = customer paid the exact amount (one-key billing)
      if (p.received.trim() === "") return null;
      const received = money(p.received);
      if (received < 0) return "Enter a valid cash amount";
      if (received < netPaise) return "Received is less than the total";
      return null;
    }
    case "split": {
      const parts = [p.split.cash, p.split.upi, p.split.card].map((v) =>
        v.trim() === "" ? 0 : money(v),
      );
      if (parts.some((n) => n < 0)) return "Enter valid split amounts";
      const sum = parts.reduce((a, b) => a + b, 0);
      if (sum !== netPaise) return "Split amounts must add up to the total";
      return null;
    }
    case "udhaar": {
      // Udhaar always goes on a customer's account (khata)
      if (!customerId) return "Choose the customer's account for udhaar";
      const name = cleanText(customerName, BILLING_LIMITS.customerMax);
      if (!name || name.toLowerCase() === WALK_IN.toLowerCase()) {
        return "Choose the customer's account for udhaar";
      }
      return null;
    }
    case "upi":
    case "card":
    case "wallet":
      return null;
    default:
      return "Choose a payment method";
  }
}

function toSalePayment(p: PaymentDraft, netPaise: Paise): SalePayment {
  const reference = cleanText(p.reference, BILLING_LIMITS.referenceMax);
  if (p.method === "cash") {
    const receivedPaise =
      p.received.trim() === "" ? netPaise : money(p.received);
    return {
      method: "cash",
      receivedPaise,
      changePaise: receivedPaise - netPaise,
      split: null,
      reference: "",
    };
  }
  if (p.method === "split") {
    const v = (s: string) => (s.trim() === "" ? 0 : money(s));
    return {
      method: "split",
      receivedPaise: 0,
      changePaise: 0,
      split: {
        cashPaise: v(p.split.cash),
        upiPaise: v(p.split.upi),
        cardPaise: v(p.split.card),
      },
      reference,
    };
  }
  return {
    method: p.method,
    receivedPaise: 0,
    changePaise: 0,
    split: null,
    reference,
  };
}

/**
 * Validates everything and builds the Sale plus the exact stock change.
 * The caller applies the stock change first and stores the sale after.
 */
export function buildSale(
  input: SaleInput,
  medicines: ReadonlyMap<string, Medicine>,
  batches: readonly StockBatch[],
  billNo: string,
  now: Date,
  /** This shop's GSTIN (Settings) — needed for a B2B bill */
  shopGstin = "",
): { sale: Sale; change: StockChangeLine[] } {
  if (input.cart.length === 0) throw new SaleError("Add at least one medicine");
  if (input.cart.length > BILLING_LIMITS.maxLines) {
    throw new SaleError(`Max ${BILLING_LIMITS.maxLines} items per bill`);
  }
  if (!(input.payment.method in PAYMENT_METHOD_LABELS)) {
    throw new SaleError("Choose a payment method");
  }

  const seen = new Set<string>();
  const lines: SaleLine[] = [];
  const change: StockChangeLine[] = [];
  for (const cartLine of input.cart) {
    if (seen.has(cartLine.medicineId))
      throw new SaleError("Same medicine added twice");
    seen.add(cartLine.medicineId);
    const m = medicines.get(cartLine.medicineId);
    const err = validateCartLine(cartLine, m);
    if (err || !m) throw new SaleError(err ?? "Medicine not found");
    const built = buildSaleLine(cartLine, m, batches, now);
    lines.push(built.saleLine);
    change.push(...built.change);
  }

  const customerName =
    cleanText(input.customerName, BILLING_LIMITS.customerMax) || WALK_IN;
  const b2b = b2bParty(input.customerGstin, shopGstin, customerName);
  const totals = calcSaleTotals(lines);
  // Another state: the whole GST is IGST (shown as such on the bill)
  if (b2b.interstate) {
    totals.cgstPaise = 0;
    totals.sgstPaise = 0;
  }
  const payErr = validatePayment(
    input.payment,
    totals.netPaise,
    customerName,
    input.customerId ?? null,
  );
  if (payErr) throw new SaleError(payErr);
  const doctor = cleanText(input.doctor, 80);
  const rxErr = scheduleRule(lines, customerName, doctor);
  if (rxErr) throw new SaleError(rxErr);

  return {
    sale: {
      id: newId("sale"),
      billNo,
      createdAt: now.toISOString(),
      customerName,
      doctor,
      counter: cleanText(input.counter, 30),
      lines,
      totals,
      payment: toSalePayment(input.payment, totals.netPaise),
      status: input.payment.method === "udhaar" ? "udhaar" : "paid",
      customerId: input.customerId ?? null,
      returnedPaise: 0,
      ...b2b,
    },
    change,
  };
}

/**
 * B2B (GST) bill: the buyer's GSTIN must be valid, the shop must have one,
 * and the bill needs the buyer's name. Different state → IGST.
 */
export function b2bParty(
  rawGstin: string | undefined,
  shopGstin: string,
  customerName: string,
): { customerGstin?: string; interstate?: boolean } {
  const gstin = (rawGstin ?? "").trim().toUpperCase();
  if (!gstin) return {};
  const c = checkGstin(gstin);
  if (!c.ok) throw new SaleError(`Customer GSTIN: ${c.reason}`);
  if (!shopGstin)
    throw new SaleError(
      "Add your shop's GSTIN in Settings → Shop to make a GST (B2B) bill",
    );
  if (gstin === shopGstin)
    throw new SaleError("Customer GSTIN is your own shop's GSTIN");
  const name = customerName.trim().toLowerCase();
  if (!name || name === WALK_IN.toLowerCase())
    throw new SaleError("Enter the buyer's name for a GST (B2B) bill");
  return gstin.slice(0, 2) === shopGstin.slice(0, 2)
    ? { customerGstin: gstin }
    : { customerGstin: gstin, interstate: true };
}
