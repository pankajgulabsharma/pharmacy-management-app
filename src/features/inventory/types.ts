import type { MedicineCategory, PackUnit } from "@/features/medicines/types";

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
  | "all"
  | "in_stock"
  | "low"
  | "out"
  | "expiring"
  | "expired";

export type StockAdjustValues = {
  qtyStrip: string;
  qtyLoose: string;
  reason: string;
};
