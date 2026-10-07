/**
 * Shape of everything the app may send for stock-and-money operations.
 * Strict: wrong types or extra fields are refused before any rule runs.
 * (The rules themselves then run inside the services.)
 */
import { z } from "zod";
import {
  BILLING_LIMITS,
  SALE_RETURN_REASONS,
} from "@medicare/domain/billing/types";
import {
  CUSTOMER_LIMITS,
  PAYMENT_IN_METHODS,
} from "@medicare/domain/customers/types";
import { GST_RATES } from "@medicare/domain/lib/gst";
import { PACK_UNITS } from "@medicare/domain/medicines/clean";
import {
  PURCHASE_LIMITS,
  RETURN_REASONS,
} from "@medicare/domain/purchases/types";
import { InputError, describe } from "../schemas/medicine";

const id = z.string().min(1).max(64);
const str = (max: number) => z.string().max(max);
const qty = z.number().int().min(0).max(100_000);
const gst = z.union(
  GST_RATES.map((r) => z.literal(r)) as unknown as [
    z.ZodLiteral<0>,
    z.ZodLiteral<5>,
    z.ZodLiteral<12>,
    z.ZodLiteral<18>,
  ],
);

const cartLine = z
  .object({
    lineId: id,
    medicineId: id,
    qtyStrip: qty,
    qtyLoose: qty,
    discountPercent: z.number().min(0).max(100),
  })
  .strict();

export const saleInput = z
  .object({
    cart: z.array(cartLine).min(1).max(BILLING_LIMITS.maxLines),
    customerName: str(200),
    customerId: id.nullish(),
    doctor: str(200),
    counter: str(60),
    payment: z
      .object({
        method: z.enum(["cash", "upi", "card", "wallet", "udhaar", "split"]),
        received: str(20),
        reference: str(60),
        split: z
          .object({ cash: str(20), upi: str(20), card: str(20) })
          .strict(),
      })
      .strict(),
  })
  .strict();

export const saleReturnInput = z
  .object({
    saleId: id,
    reason: z.enum(SALE_RETURN_REASONS),
    refundMode: z.enum(["cash", "upi", "udhaar_adjust"]),
    notes: str(300),
    lines: z
      .array(
        z.object({ saleLineId: id, qtyStrip: qty, qtyLoose: qty }).strict(),
      )
      .min(1)
      .max(BILLING_LIMITS.maxLines),
  })
  .strict();

export const holdInput = z
  .object({
    customerName: str(200),
    doctor: str(200),
    counter: str(60),
    lines: z.array(cartLine).max(BILLING_LIMITS.maxLines),
  })
  .strict();

const purchaseLineDraft = z
  .object({
    key: id,
    medicineId: id,
    medicineName: str(200),
    brand: str(200),
    hsn: str(20),
    unit: z.enum(PACK_UNITS),
    unitsPerStrip: z.number().int().min(1).max(500),
    batchNo: str(40),
    expiry: str(10),
    qty: str(12),
    freeQty: str(12),
    rate: str(16),
    mrp: str(16),
    discountPercent: str(8),
    gstPercent: gst,
  })
  .strict();

export const purchaseDraft = z
  .object({
    supplierId: id,
    invoiceNo: str(PURCHASE_LIMITS.invoiceNoMax * 2),
    invoiceDate: str(10),
    notes: str(PURCHASE_LIMITS.notesMax * 2),
    paid: str(16),
    lines: z.array(purchaseLineDraft).max(PURCHASE_LIMITS.maxLines),
  })
  .strict();

export const purchaseEdit = z
  .object({ draft: purchaseDraft, revision: z.number().int().min(1) })
  .strict();
export const cancelInput = z.object({ reason: str(400) }).strict();
export const supplierPayment = z
  .object({ amountPaise: z.number().int().positive().max(10_000_000_00) })
  .strict();

export const purchaseReturnInput = z
  .object({
    purchaseId: id,
    date: str(10),
    reason: z.enum(
      Object.keys(RETURN_REASONS) as [
        keyof typeof RETURN_REASONS,
        ...(keyof typeof RETURN_REASONS)[],
      ],
    ),
    notes: str(400),
    lines: z
      .array(
        z
          .object({
            purchaseLineId: id,
            qty: z.number().int().positive().max(100_000),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const adjustInput = z
  .object({ batchId: id, qtyStrip: qty, qtyLoose: qty, reason: str(400) })
  .strict();

export const customerInput = z
  .object({
    name: str(CUSTOMER_LIMITS.nameMax * 2),
    phone: str(20),
    address: str(CUSTOMER_LIMITS.addressMax * 2),
    creditLimitPaise: z
      .number()
      .int()
      .min(0)
      .max(CUSTOMER_LIMITS.maxCreditLimitPaise),
    notes: str(CUSTOMER_LIMITS.notesMax * 2),
    status: z.enum(["active", "inactive"]),
  })
  .strict();

export const customerPayment = z
  .object({
    customerId: id,
    amount: str(16),
    method: z.enum(PAYMENT_IN_METHODS),
    reference: str(80),
    note: str(400),
  })
  .strict();

/** Check the shape; a mismatch becomes a 400 with the first problem */
export function parse<S extends z.ZodType>(
  schema: S,
  body: unknown,
): z.infer<S> {
  const r = schema.safeParse(body);
  if (!r.success) throw new InputError(describe(r.error));
  return r.data;
}
