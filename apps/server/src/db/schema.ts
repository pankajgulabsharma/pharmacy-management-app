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
    /** "650 mg", "500 mg + 125 mg" — salt + strength + form = substitute */
    strength: text("strength").notNull().default(""),
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
    /** "" (OTC) | H | H1 | X — prescription / register rules */
    schedule: text("schedule").notNull().default(""),
    status: text("status", { enum: ["active", "inactive"] })
      .notNull()
      .default("active"),
  },
  (t) => [
    index("medicines_name_idx").on(t.name),
    // A barcode belongs to ONE medicine (scanning must never be ambiguous)
    uniqueIndex("medicines_barcode_uq")
      .on(t.barcode)
      .where(sql`${t.barcode} <> ''`),
    check(
      "medicines_price_ok",
      sql`${t.mrpPaise} >= 0 AND ${t.salePricePaise} >= 0 AND ${t.salePricePaise} <= ${t.mrpPaise}`,
    ),
    check("medicines_gst_ok", sql`${t.gstPercent} IN (0, 5, 12, 18)`),
  ],
);

/**
 * Each medicine import (Excel / Marg / Tally file) — so a wrong file can
 * be undone in one click while nothing from it has been used yet.
 * The stock it added is found by ref_id = id in stock_movements.
 */
export const medicineImports = sqliteTable("medicine_imports", {
  id: id(),
  at: text("at").notNull(),
  rows: integer("rows").notNull(),
  /** JSON array — medicines this import created (not ones it reused) */
  createdIdsJson: text("created_ids_json").notNull().default("[]"),
  existingCount: integer("existing_count").notNull().default(0),
  batchLines: integer("batch_lines").notNull().default(0),
  /** "" = in force; else when it was undone */
  undoneAt: text("undone_at").notNull().default(""),
});

/**
 * Each customer / supplier import (switching from other software) — so a
 * wrong file can be undone while none of those parties is used yet.
 */
export const partyImports = sqliteTable("party_imports", {
  id: id(),
  kind: text("kind", { enum: ["customers", "suppliers"] }).notNull(),
  at: text("at").notNull(),
  rows: integer("rows").notNull(),
  /** JSON array — customers / suppliers this import created */
  createdIdsJson: text("created_ids_json").notNull().default("[]"),
  /** JSON array — old-dues entries (purchases) it created for suppliers */
  openingIdsJson: text("opening_ids_json").notNull().default("[]"),
  openingPaise: integer("opening_paise").notNull().default(0),
  existingCount: integer("existing_count").notNull().default(0),
  /** "" = in force; else when it was undone */
  undoneAt: text("undone_at").notNull().default(""),
});

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

export const suppliers = sqliteTable(
  "suppliers",
  {
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
  },
  (t) => [
    // One supplier per GSTIN, and per name (ignoring case)
    uniqueIndex("suppliers_gstin_uq")
      .on(t.gstin)
      .where(sql`${t.gstin} <> ''`),
    uniqueIndex("suppliers_name_uq").on(sql`lower(${t.name})`),
  ],
);

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
    /** Old udhaar brought over from the previous software / khata */
    openingBalancePaise: paise("opening_balance_paise"),
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
    /** Who was signed in when the bill was saved */
    billedBy: text("billed_by").notNull().default(""),
    status: text("status", { enum: ["paid", "udhaar"] }).notNull(),
    imported: bool("imported"),
    /** B2B bill: buyer's GSTIN ("" = normal retail bill) */
    customerGstin: text("customer_gstin").notNull().default(""),
    /** For the H1 / X / NDPS register */
    patientAddress: text("patient_address").notNull().default(""),
    /** Buyer in another state → IGST */
    interstate: bool("interstate"),
    /** Composition scheme: a Bill of Supply, no GST */
    billOfSupply: bool("bill_of_supply"),
    /** Loyalty: points earned / used on this bill, balance after it */
    pointsEarned: paise("points_earned"),
    pointsRedeemed: paise("points_redeemed"),
    pointsBalance: integer("points_balance").notNull().default(0),
    /** Value of the points used (already off net_paise) */
    pointsPaise: paise("points_paise"),
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
    /** Schedule at billing time (H1 / X go into the register) */
    schedule: text("schedule").notNull().default(""),
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
    billedBy: text("billed_by").notNull().default(""),
    roundOffPaise: paise("round_off_paise"),
    refundPaise: paise("refund_paise"),
    /** Loyalty: points taken back (earned) / given back (spent) */
    pointsReversed: paise("points_reversed"),
    pointsRestored: paise("points_restored"),
  },
  (t) => [
    index("sale_returns_sale_idx").on(t.saleId),
    index("sale_returns_created_idx").on(t.createdAt),
  ],
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

/** People who can sign in. Passwords: slow hash (scrypt) only, never plain text. */
export const users = sqliteTable("users", {
  id: id(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["owner", "pharmacist", "cashier"] }).notNull(),
  passwordHash: text("password_hash").notNull(),
  /** Staff: 4-digit PIN for the counter (slow hash too); null = password only */
  pinHash: text("pin_hash"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  /** Starter password (first owner / reset) → must choose a new one */
  mustChangePassword: integer("must_change_password", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: createdAt(),
});

/**
 * Signed-in devices. Only a SHA-256 of the token is stored, so a copied
 * database file can't be used to sign in. Deleted on sign-out.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    /** Which computer signed in (counts towards the licence's counters) */
    ip: text("ip").notNull().default(""),
  },
  (s) => [index("sessions_user_idx").on(s.userId)],
);

/**
 * Commission paid to a doctor (referrals) or a staff member, for a period.
 * The amounts owed are worked out from the bills; only payouts are stored.
 */
export const commissionPayouts = sqliteTable(
  "commission_payouts",
  {
    id: id(),
    kind: text("kind", { enum: ["doctor", "staff"] }).notNull(),
    name: text("name").notNull(),
    fromDate: text("from_date").notNull(),
    toDate: text("to_date").notNull(),
    amountPaise: paise("amount_paise"),
    paidAt: text("paid_at").notNull(),
    note: text("note").notNull().default(""),
    paidBy: text("paid_by").notNull().default(""),
  },
  (t) => [
    index("commission_payouts_period_idx").on(t.fromDate),
    check("commission_payouts_amount_ok", sql`${t.amountPaise} > 0`),
  ],
);

/**
 * Sign-in history (Multi-counter plan): who signed in where and when.
 * `session_hash` ties a row to its session so sign-out closes it.
 */
export const signIns = sqliteTable(
  "sign_ins",
  {
    id: id(),
    sessionHash: text("session_hash").notNull().default(""),
    userId: text("user_id").notNull(),
    userName: text("user_name").notNull(),
    role: text("role").notNull(),
    counter: text("counter").notNull().default(""),
    computer: text("computer").notNull().default(""),
    method: text("method", { enum: ["pin", "password", "setup"] }).notNull(),
    signedInAt: text("signed_in_at").notNull(),
    signedOutAt: text("signed_out_at"),
    reason: text("reason").notNull().default(""),
  },
  (t) => [
    index("sign_ins_at_idx").on(t.signedInAt),
    index("sign_ins_session_idx").on(t.sessionHash),
  ],
);

/** Galla: one row per drawer per business day (opened → closed) */
export const cashDays = sqliteTable(
  "cash_days",
  {
    id: id(),
    date: text("date").notNull(),
    counter: text("counter").notNull().default(""),
    status: text("status", { enum: ["open", "closed"] }).notNull(),
    openingPaise: paise("opening_paise"),
    openedAt: text("opened_at").notNull(),
    openedBy: text("opened_by").notNull().default(""),
    countedPaise: integer("counted_paise"),
    expectedPaise: integer("expected_paise"),
    keptPaise: integer("kept_paise"),
    denominationsJson: text("denominations_json").notNull().default("{}"),
    closedAt: text("closed_at"),
    closedBy: text("closed_by").notNull().default(""),
    note: text("note").notNull().default(""),
  },
  (t) => [
    uniqueIndex("cash_days_date_counter_idx").on(t.date, t.counter),
    check("cash_days_opening_ok", sql`${t.openingPaise} >= 0`),
  ],
);

/** Galla: cash put in / taken out (typed, or written when money moves) */
export const cashEntries = sqliteTable(
  "cash_entries",
  {
    id: id(),
    date: text("date").notNull(),
    counter: text("counter").notNull().default(""),
    at: text("at").notNull(),
    kind: text("kind", { enum: ["in", "out"] }).notNull(),
    category: text("category").notNull(),
    amountPaise: paise("amount_paise"),
    note: text("note").notNull().default(""),
    by: text("by").notNull().default(""),
    source: text("source", {
      enum: ["manual", "refund", "udhaar", "supplier"],
    }).notNull(),
    ref: text("ref").notNull().default(""),
  },
  (t) => [
    index("cash_entries_day_idx").on(t.date, t.counter),
    check("cash_entries_amount_ok", sql`${t.amountPaise} > 0`),
  ],
);

/** Stock count (physical stock taking) — see @medicare/domain/inventory/stockCount */
export const stockCounts = sqliteTable(
  "stock_counts",
  {
    id: id(),
    countNo: text("count_no").notNull().unique(),
    racksJson: text("racks_json").notNull().default("[]"),
    status: text("status", { enum: ["open", "posted", "cancelled"] }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
    createdBy: text("created_by").notNull().default(""),
    postedAt: text("posted_at"),
    postedBy: text("posted_by").notNull().default(""),
    summaryJson: text("summary_json"),
  },
  (t) => [index("stock_counts_status_idx").on(t.status)],
);

export const stockCountLines = sqliteTable(
  "stock_count_lines",
  {
    countId: text("count_id")
      .notNull()
      .references(() => stockCounts.id, { onDelete: "cascade" }),
    batchId: text("batch_id").notNull(),
    medicineId: text("medicine_id").notNull(),
    systemStrip: integer("system_strip").notNull().default(0),
    systemLoose: integer("system_loose").notNull().default(0),
    countedStrip: integer("counted_strip"),
    countedLoose: integer("counted_loose"),
    countedBy: text("counted_by").notNull().default(""),
    countedAt: text("counted_at"),
  },
  (t) => [uniqueIndex("stock_count_lines_pk").on(t.countId, t.batchId)],
);

/** Purchase orders (Purchases → Orders); lines and receipts as JSON */
export const purchaseOrders = sqliteTable(
  "purchase_orders",
  {
    id: id(),
    orderNo: text("order_no").notNull().unique(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    supplierName: text("supplier_name").notNull(),
    status: text("status", {
      enum: ["open", "sent", "partial", "received", "closed", "cancelled"],
    }).notNull(),
    date: text("date").notNull(),
    notes: text("notes").notNull().default(""),
    linesJson: text("lines_json").notNull().default("[]"),
    receiptsJson: text("receipts_json").notNull().default("[]"),
    createdAt: createdAt(),
    createdBy: text("created_by").notNull().default(""),
    sentAt: text("sent_at"),
    closedAt: text("closed_at"),
  },
  (t) => [
    index("purchase_orders_status_idx").on(t.status),
    index("purchase_orders_supplier_idx").on(t.supplierId),
  ],
);
