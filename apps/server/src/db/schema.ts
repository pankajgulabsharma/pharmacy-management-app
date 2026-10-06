/**
 * The shop's register — every table in the database.
 *
 * Rules used everywhere:
 *  • Money is INTEGER paise (₹105.50 → 10550): no rounding errors, ever.
 *  • Dates are ISO text ("2026-10-06" or full timestamps, UTC).
 *  • The database itself refuses impossible data (CHECK constraints),
 *    e.g. stock below zero — a last line of defence behind the rules.
 */
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const paise = (name: string) => integer(name).notNull().default(0);
const bool = (name: string) =>
  integer(name, { mode: "boolean" }).notNull().default(false);
const createdAt = () => text("created_at").notNull();

/* ------------------------------------------------------------------ */
/* Medicines & stock                                                  */
/* ------------------------------------------------------------------ */

/** Medicine master — what the shop sells (price & rules, not stock) */
export const medicines = sqliteTable(
  "medicines",
  {
    id: id(),
    name: text("name").notNull(),
    salt: text("salt").notNull().default(""),
    brand: text("brand").notNull().default(""),
    category: text("category").notNull(),
    hsn: text("hsn").notNull().default(""),
    barcode: text("barcode").notNull().default(""),
    rack: text("rack").notNull().default(""),
    unit: text("unit").notNull(), // STP, BTL, BOX, LSE…
    unitsPerStrip: integer("units_per_strip").notNull().default(1),
    allowLoose: bool("allow_loose"),
    mrpPaise: paise("mrp_paise"),
    salePricePaise: paise("sale_price_paise"),
    minStock: integer("min_stock").notNull().default(0),
    gstPercent: integer("gst_percent").notNull(),
    status: text("status", { enum: ["active", "inactive"] })
      .notNull()
      .default("active"),
  },
  (t) => [
    index("medicines_name_idx").on(t.name),
    check(
      "medicines_price_ok",
      sql`${t.mrpPaise} >= 0 AND ${t.salePricePaise} >= 0 AND ${t.salePricePaise} <= ${t.mrpPaise}`,
    ),
    check("medicines_gst_ok", sql`${t.gstPercent} IN (0, 5, 12, 18)`),
  ],
);

/** One batch of a medicine on the shelf (stock lives here) */
export const batches = sqliteTable(
  "batches",
  {
    id: id(),
    medicineId: text("medicine_id")
      .notNull()
      .references(() => medicines.id),
    batchNo: text("batch_no").notNull(),
    expiry: text("expiry").notNull(), // MM/YY
    qtyStrip: integer("qty_strip").notNull().default(0),
    qtyLoose: integer("qty_loose").notNull().default(0),
    mrpPaise: paise("mrp_paise"),
    purchasePricePaise: paise("purchase_price_paise"),
    receivedAt: text("received_at").notNull(),
  },
  (t) => [
    uniqueIndex("batches_medicine_batch_uq").on(t.medicineId, t.batchNo),
    check(
      "batches_stock_not_negative",
      sql`${t.qtyStrip} >= 0 AND ${t.qtyLoose} >= 0`,
    ),
  ],
);

/** Every stock change, ever (the audit trail behind Batch History) */
export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: id(),
    type: text("type").notNull(), // opening, purchase, sale, sale_return, adjustment…
    batchId: text("batch_id")
      .notNull()
      .references(() => batches.id),
    medicineId: text("medicine_id")
      .notNull()
      .references(() => medicines.id),
    qtyStripDelta: integer("qty_strip_delta").notNull(),
    qtyLooseDelta: integer("qty_loose_delta").notNull(),
    at: text("at").notNull(),
    refId: text("ref_id").notNull().default(""), // bill / invoice / return id
    note: text("note").notNull().default(""),
  },
  (t) => [
    index("movements_batch_idx").on(t.batchId, t.at),
    index("movements_ref_idx").on(t.refId),
  ],
);

/* ------------------------------------------------------------------ */
/* Suppliers & purchases                                              */
/* ------------------------------------------------------------------ */

export const suppliers = sqliteTable("suppliers", {
  id: id(),
  name: text("name").notNull(),
  gstin: text("gstin").notNull().default(""),
  drugLicenseNo: text("drug_license_no").notNull().default(""),
  contactPerson: text("contact_person").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  creditDays: integer("credit_days").notNull().default(0),
  status: text("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active"),
  createdAt: createdAt(),
});

/** Supplier invoice (header) */
export const purchases = sqliteTable(
  "purchases",
  {
    id: id(),
    status: text("status", { enum: ["active", "cancelled"] })
      .notNull()
      .default("active"),
    stockPosted: bool("stock_posted"),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    supplierName: text("supplier_name").notNull(), // as printed on the invoice
    supplierGstin: text("supplier_gstin").notNull().default(""),
    invoiceNo: text("invoice_no").notNull(),
    invoiceDate: text("invoice_date").notNull(),
    dueDate: text("due_date").notNull(),
    notes: text("notes").notNull().default(""),
    // totals (kept so reports don't recompute every invoice)
    lineCount: integer("line_count").notNull(),
    totalQty: integer("total_qty").notNull(),
    totalFreeQty: integer("total_free_qty").notNull(),
    grossPaise: paise("gross_paise"),
    discountPaise: paise("discount_paise"),
    taxablePaise: paise("taxable_paise"),
    cgstPaise: paise("cgst_paise"),
    sgstPaise: paise("sgst_paise"),
    gstPaise: paise("gst_paise"),
    roundOffPaise: paise("round_off_paise"),
    netPaise: paise("net_paise"),
    paidPaise: paise("paid_paise"),
    returnedPaise: paise("returned_paise"),
    revision: integer("revision").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: text("updated_at").notNull().default(""),
    cancelledAt: text("cancelled_at").notNull().default(""),
    cancelReason: text("cancel_reason").notNull().default(""),
  },
  (t) => [
    uniqueIndex("purchases_supplier_invoice_uq").on(t.supplierId, t.invoiceNo),
    index("purchases_date_idx").on(t.invoiceDate),
    check(
      "purchases_money_ok",
      sql`${t.paidPaise} >= 0 AND ${t.returnedPaise} >= 0 AND ${t.netPaise} >= 0`,
    ),
  ],
);

/** One line of a supplier invoice */
export const purchaseLines = sqliteTable(
  "purchase_lines",
  {
    id: id(),
    purchaseId: text("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    medicineId: text("medicine_id")
      .notNull()
      .references(() => medicines.id),
    medicineName: text("medicine_name").notNull(),
    brand: text("brand").notNull().default(""),
    hsn: text("hsn").notNull().default(""),
    unit: text("unit").notNull(),
    unitsPerStrip: integer("units_per_strip").notNull().default(1),
    batchNo: text("batch_no").notNull(),
    expiry: text("expiry").notNull(),
    qty: integer("qty").notNull(),
    freeQty: integer("free_qty").notNull().default(0),
    ratePaise: paise("rate_paise"),
    mrpPaise: paise("mrp_paise"),
    discountPercent: integer("discount_percent").notNull().default(0),
    gstPercent: integer("gst_percent").notNull(),
  },
  (t) => [
    index("purchase_lines_purchase_idx").on(t.purchaseId),
    check("purchase_lines_qty_ok", sql`${t.qty} > 0 AND ${t.freeQty} >= 0`),
  ],
);

/** Debit note — goods returned to a supplier */
export const purchaseReturns = sqliteTable(
  "purchase_returns",
  {
    id: id(),
    returnNo: text("return_no").notNull().unique(),
    purchaseId: text("purchase_id")
      .notNull()
      .references(() => purchases.id),
    invoiceNo: text("invoice_no").notNull(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    supplierName: text("supplier_name").notNull(),
    supplierGstin: text("supplier_gstin").notNull().default(""),
    date: text("date").notNull(),
    reason: text("reason").notNull(),
    notes: text("notes").notNull().default(""),
    totalQty: integer("total_qty").notNull(),
    totalPaise: paise("total_paise"),
    gstPaise: paise("gst_paise"),
    createdAt: createdAt(),
  },
  (t) => [index("purchase_returns_purchase_idx").on(t.purchaseId)],
);

export const purchaseReturnLines = sqliteTable("purchase_return_lines", {
  id: id(),
  returnId: text("return_id")
    .notNull()
    .references(() => purchaseReturns.id, { onDelete: "cascade" }),
  purchaseLineId: text("purchase_line_id")
    .notNull()
    .references(() => purchaseLines.id),
  medicineId: text("medicine_id")
    .notNull()
    .references(() => medicines.id),
  medicineName: text("medicine_name").notNull(),
  brand: text("brand").notNull().default(""),
  unit: text("unit").notNull(),
  unitsPerStrip: integer("units_per_strip").notNull().default(1),
  batchNo: text("batch_no").notNull(),
  expiry: text("expiry").notNull(),
  qty: integer("qty").notNull(),
  ratePaise: paise("rate_paise"),
  gstPercent: integer("gst_percent").notNull(),
  amountPaise: paise("amount_paise"),
  gstPaise: paise("gst_paise"),
});

/* ------------------------------------------------------------------ */
/* Customers (udhaar)                                                 */
/* ------------------------------------------------------------------ */

export const customers = sqliteTable(
  "customers",
  {
    id: id(),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    creditLimitPaise: paise("credit_limit_paise"),
    notes: text("notes").notNull().default(""),
    status: text("status", { enum: ["active", "inactive"] })
      .notNull()
      .default("active"),
    createdAt: createdAt(),
  },
  // One account per mobile number (empty numbers allowed)
  (t) => [
    uniqueIndex("customers_phone_uq")
      .on(t.phone)
      .where(sql`${t.phone} <> ''`),
  ],
);

/** Money received against udhaar */
export const customerPayments = sqliteTable(
  "customer_payments",
  {
    id: id(),
    receiptNo: text("receipt_no").notNull().unique(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    at: text("at").notNull(),
    amountPaise: paise("amount_paise"),
    method: text("method", { enum: ["cash", "upi", "card"] }).notNull(),
    reference: text("reference").notNull().default(""),
    note: text("note").notNull().default(""),
  },
  (t) => [
    index("customer_payments_customer_idx").on(t.customerId),
    check("customer_payments_positive", sql`${t.amountPaise} > 0`),
  ],
);

/* ------------------------------------------------------------------ */
/* Sales (bills) & sales returns                                      */
/* ------------------------------------------------------------------ */

export const sales = sqliteTable(
  "sales",
  {
    id: id(),
    billNo: text("bill_no").notNull().unique(),
    createdAt: createdAt(),
    customerId: text("customer_id").references(() => customers.id), // set for udhaar
    customerName: text("customer_name").notNull(),
    doctor: text("doctor").notNull().default(""),
    counter: text("counter").notNull().default(""),
    status: text("status", { enum: ["paid", "udhaar"] }).notNull(),
    imported: bool("imported"),
    // totals
    itemCount: integer("item_count").notNull(),
    grossPaise: paise("gross_paise"),
    discountPaise: paise("discount_paise"),
    taxablePaise: paise("taxable_paise"),
    cgstPaise: paise("cgst_paise"),
    sgstPaise: paise("sgst_paise"),
    gstPaise: paise("gst_paise"),
    roundOffPaise: paise("round_off_paise"),
    netPaise: paise("net_paise"),
    returnedPaise: paise("returned_paise"),
    // payment
    paymentMethod: text("payment_method").notNull(),
    receivedPaise: paise("received_paise"),
    changePaise: paise("change_paise"),
    splitCashPaise: paise("split_cash_paise"),
    splitUpiPaise: paise("split_upi_paise"),
    splitCardPaise: paise("split_card_paise"),
    paymentReference: text("payment_reference").notNull().default(""),
  },
  (t) => [
    index("sales_created_idx").on(t.createdAt),
    index("sales_customer_idx").on(t.customerId),
    // Udhaar must always be on a customer account
    check(
      "sales_udhaar_has_customer",
      sql`${t.status} <> 'udhaar' OR ${t.customerId} IS NOT NULL`,
    ),
    check(
      "sales_money_ok",
      sql`${t.netPaise} >= 0 AND ${t.returnedPaise} >= 0 AND ${t.returnedPaise} <= ${t.netPaise}`,
    ),
  ],
);

export const saleLines = sqliteTable(
  "sale_lines",
  {
    id: id(),
    saleId: text("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    medicineId: text("medicine_id")
      .notNull()
      .references(() => medicines.id),
    medicineName: text("medicine_name").notNull(),
    brand: text("brand").notNull().default(""),
    hsn: text("hsn").notNull().default(""),
    unit: text("unit").notNull(),
    unitsPerStrip: integer("units_per_strip").notNull().default(1),
    gstPercent: integer("gst_percent").notNull(),
    discountPercent: integer("discount_percent").notNull().default(0),
    qtyStrip: integer("qty_strip").notNull().default(0),
    qtyLoose: integer("qty_loose").notNull().default(0),
    grossPaise: paise("gross_paise"),
    discountPaise: paise("discount_paise"),
    amountPaise: paise("amount_paise"),
    taxablePaise: paise("taxable_paise"),
    gstPaise: paise("gst_paise"),
  },
  (t) => [index("sale_lines_sale_idx").on(t.saleId)],
);

/** Which batches a bill line was taken from (FEFO) */
export const saleAllocations = sqliteTable(
  "sale_allocations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleLineId: text("sale_line_id")
      .notNull()
      .references(() => saleLines.id, { onDelete: "cascade" }),
    batchId: text("batch_id")
      .notNull()
      .references(() => batches.id),
    batchNo: text("batch_no").notNull(),
    expiry: text("expiry").notNull(),
    qtyStrip: integer("qty_strip").notNull().default(0),
    qtyLoose: integer("qty_loose").notNull().default(0),
    breakStrips: integer("break_strips").notNull().default(0),
    ratePaise: paise("rate_paise"),
    mrpPaise: paise("mrp_paise"),
    costPaise: paise("cost_paise"),
  },
  (t) => [index("sale_allocations_line_idx").on(t.saleLineId)],
);

export const saleReturns = sqliteTable(
  "sale_returns",
  {
    id: id(),
    returnNo: text("return_no").notNull().unique(),
    saleId: text("sale_id")
      .notNull()
      .references(() => sales.id),
    billNo: text("bill_no").notNull(),
    customerName: text("customer_name").notNull(),
    createdAt: createdAt(),
    reason: text("reason").notNull(),
    refundMode: text("refund_mode", {
      enum: ["cash", "upi", "udhaar_adjust"],
    }).notNull(),
    notes: text("notes").notNull().default(""),
    roundOffPaise: paise("round_off_paise"),
    refundPaise: paise("refund_paise"),
  },
  (t) => [index("sale_returns_sale_idx").on(t.saleId)],
);

export const saleReturnLines = sqliteTable("sale_return_lines", {
  id: id(),
  returnId: text("return_id")
    .notNull()
    .references(() => saleReturns.id, { onDelete: "cascade" }),
  saleLineId: text("sale_line_id")
    .notNull()
    .references(() => saleLines.id),
  medicineId: text("medicine_id")
    .notNull()
    .references(() => medicines.id),
  medicineName: text("medicine_name").notNull(),
  unit: text("unit").notNull(),
  unitsPerStrip: integer("units_per_strip").notNull().default(1),
  qtyStrip: integer("qty_strip").notNull().default(0),
  qtyLoose: integer("qty_loose").notNull().default(0),
  amountPaise: paise("amount_paise"),
});

/** Where returned goods went back on the shelf */
export const saleReturnBatches = sqliteTable("sale_return_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  returnLineId: text("return_line_id")
    .notNull()
    .references(() => saleReturnLines.id, { onDelete: "cascade" }),
  batchId: text("batch_id")
    .notNull()
    .references(() => batches.id),
  qtyStrip: integer("qty_strip").notNull().default(0),
  qtyLoose: integer("qty_loose").notNull().default(0),
});

/** Bills parked with "Hold" (cart kept as JSON — it is a draft, not a sale) */
export const heldBills = sqliteTable("held_bills", {
  id: id(),
  heldAt: text("held_at").notNull(),
  customerName: text("customer_name").notNull().default(""),
  doctor: text("doctor").notNull().default(""),
  counter: text("counter").notNull().default(""),
  linesJson: text("lines_json").notNull(),
});

/* ------------------------------------------------------------------ */
/* Settings & users                                                   */
/* ------------------------------------------------------------------ */

/** Shop settings, one row per section (shop, billing, inventory, lists) */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** People who can sign in. Passwords: slow hash only (Step 10), never plain text. */
export const users = sqliteTable("users", {
  id: id(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["owner", "pharmacist", "cashier"] }).notNull(),
  passwordHash: text("password_hash").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});
