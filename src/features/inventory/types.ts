import type { MedicineCategory, PackUnit } from "@/features/medicines/types";

/* ------------------------------------------------------------------ */
/* Stored data                                                        */
/* ------------------------------------------------------------------ */

/**
 * One physical batch on the shelf. Only batch-specific facts are stored
 * here; name, rack, pack, sale price, min stock… come from the medicine
 * master, so editing a medicine updates every batch automatically.
 */
export type StockBatch = {
  id: string;
  medicineId: string;
  /** Uppercase, e.g. "DL24118" */
  batchNo: string;
  /** "MM/YY" */
  expiry: string;
  /** Whole packs in the medicine's pack unit (always 0 for LSE medicines) */
  qtyStrip: number;
  /** Loose units */
  qtyLoose: number;
  /** MRP per pack in rupees (can differ between batches) */
  mrp: number;
  /** Landed cost per pack in rupees (incl. GST, spread over free packs) */
  purchasePrice: number;
  /** ISO timestamp of the first receipt of this batch */
  receivedAt: string;
};

export type StockMovementType = "opening" | "purchase" | "adjustment";

/**
 * Append-only audit log: every change to a batch's quantity is recorded
 * with who/what caused it, so stock can always be explained and traced.
 */
export type StockMovement = {
  id: string;
  type: StockMovementType;
  batchId: string;
  medicineId: string;
  qtyStripDelta: number;
  qtyLooseDelta: number;
  /** ISO timestamp */
  at: string;
  /** Source document id (purchase id, …) */
  refId?: string;
  /** Human readable, e.g. "Purchase SGP/26-27/1184 · Om Sai…" */
  note: string;
};

/**
 * Neutral "goods received" input. Purchases (and later: sales returns,
 * opening stock import) convert their documents into this shape, so the
 * inventory module never depends on those features.
 */
export type StockReceipt = {
  /** Unique id of the source document — makes receiving idempotent */
  refId: string;
  note: string;
  at: Date;
  lines: StockReceiptLine[];
};

export type StockReceiptLine = {
  medicineId: string;
  unit: PackUnit;
  batchNo: string;
  expiry: string;
  /** Packs received including free/scheme packs */
  packs: number;
  /** MRP per pack, rupees */
  mrp: number;
  /** Landed cost per pack, rupees */
  costPerPack: number;
};

/* ------------------------------------------------------------------ */
/* View model (StockBatch joined with its medicine)                   */
/* ------------------------------------------------------------------ */

export type InventoryBatch = {
  id: string;
  medicineId: string;
  medicineName: string;
  salt: string;
  brand: string;
  category: MedicineCategory;
  hsn: string;
  batchNo: string;
  expiry: string;
  rack: string;
  unit: PackUnit;
  unitsPerStrip: number;
  allowLoose: boolean;
  qtyStrip: number;
  qtyLoose: number;
  mrp: number;
  purchasePrice: number;
  salePrice: number;
  minStock: number;
};

export type InventoryStatusFilter =
  "all" | "in_stock" | "low" | "out" | "expiring" | "expired";

export type StockAdjustValues = {
  qtyStrip: string;
  qtyLoose: string;
  reason: string;
};
