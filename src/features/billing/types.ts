import type { MedicineSearchResult } from "./data/mockBillingData";
import { canSellLoose, type PackUnit } from "@/features/medicines/types";

export type BillLineItem = {
  lineId: string;
  medicine: MedicineSearchResult;
  qtyStrip: number;
  qtyLoose: number;
  discountPercent: number;
};

export type PaymentMethod =
  | "cash"
  | "upi"
  | "card"
  | "wallet"
  | "udhaar"
  | "split";

export function getLooseUnitPrice(medicine: MedicineSearchResult): number {
  const ups = medicine.unitsPerStrip > 0 ? medicine.unitsPerStrip : 1;
  return medicine.salePrice / ups;
}

export function calcLineGross(item: BillLineItem): number {
  const { medicine, qtyStrip, qtyLoose } = item;
  const packTotal = qtyStrip * medicine.salePrice;
  const looseOk = canSellLoose(
    medicine.unit ?? "STP",
    medicine.allowLoose ?? medicine.unit === "STP",
  );
  const looseTotal = looseOk ? qtyLoose * getLooseUnitPrice(medicine) : 0;
  return packTotal + looseTotal;
}

export function calcLineDiscount(item: BillLineItem): number {
  const gross = calcLineGross(item);
  return Math.max(0, (gross * item.discountPercent) / 100);
}

export function calcLineAmount(item: BillLineItem): number {
  return Math.max(0, calcLineGross(item) - calcLineDiscount(item));
}

export function roundOffToRupee(amount: number) {
  const rounded = Math.round(amount);
  const roundOff = Number((rounded - amount).toFixed(2));
  return { rounded, roundOff };
}

export type ReturnRefundMode = "cash" | "upi" | "udhaar_adjust";

export type ReturnLineDraft = {
  lineId: string;
  medicineId: string;
  name: string;
  batch: string;
  expiry: string;
  soldStrip: number;
  soldLoose: number;
  unitsPerStrip: number;
  salePrice: number;
  discountPercent: number;
  returnStrip: number;
  returnLoose: number;
  unit?: PackUnit;
  allowLoose?: boolean;
};

export function calcReturnLineAmount(line: ReturnLineDraft): number {
  const ups = line.unitsPerStrip > 0 ? line.unitsPerStrip : 1;
  const packTotal = line.returnStrip * line.salePrice;
  const looseOk = canSellLoose(line.unit ?? "STP", line.allowLoose ?? true);
  const looseTotal = looseOk ? line.returnLoose * (line.salePrice / ups) : 0;
  const gross = packTotal + looseTotal;
  const disc = (gross * line.discountPercent) / 100;
  return Math.max(0, gross - disc);
}
