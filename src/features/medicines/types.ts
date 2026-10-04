import { DEFAULT_GST_RATE, type GstRate } from "@/lib/gst";
/** Dosage form / category */
export type MedicineCategory =
  | "tablet_capsule"
  | "syrup_suspension"
  | "cream_ointment"
  | "injection"
  | "drops"
  | "inhaler"
  | "sachet_powder"
  | "other";

/**
 * Pack units (retail + carton):
 * STP = strip, BTL = bottle/tube/vial/inhaler,
 * LSE = single loose unit, BOX = outer carton (N strips)
 */
export type PackUnit = "STP" | "BTL" | "LSE" | "BOX";

export type MedicineStatus = "active" | "inactive";

export type Medicine = {
  id: string;
  name: string;
  salt: string;
  brand: string;
  category: MedicineCategory;
  hsn: string;
  barcode: string;
  rack: string;
  unit: PackUnit;
  /**
   * STP → tablets/capsules per strip
   * BOX → strips per box
   * BTL / LSE → usually 1
   */
  unitsPerStrip: number;
  allowLoose: boolean;
  mrp: number;
  salePrice: number;
  minStock: number;
  /** GST slab for this product (by HSN). Retail price already includes it. */
  gstPercent: GstRate;
  status: MedicineStatus;
};

/**
 * Stock is NOT stored on the medicine. It is always derived from the
 * inventory batches (see useMedicinesWithStock), so there is exactly one
 * source of truth for "how much do we have".
 */
export type MedicineStock = {
  /** Total packs across all batches (in the medicine's pack unit) */
  stockStrip: number;
  /** Total loose units across all batches */
  stockLoose: number;
  /** Earliest expiry among batches that still have stock ("MM/YY") */
  nearestExpiry: string | null;
  /** Number of batches that still have stock */
  batchCount: number;
};

export type MedicineWithStock = Medicine & MedicineStock;

export const EMPTY_STOCK: MedicineStock = {
  stockStrip: 0,
  stockLoose: 0,
  nearestExpiry: null,
  batchCount: 0,
};

/** Master fields a user can create/import (everything except the id) */
export type MedicineInput = Omit<Medicine, "id">;

export type MedicineFormValues = {
  name: string;
  salt: string;
  brand: string;
  category: MedicineCategory;
  hsn: string;
  barcode: string;
  rack: string;
  unit: PackUnit;
  unitsPerStrip: string;
  allowLoose: boolean;
  mrp: string;
  salePrice: string;
  minStock: string;
  gstPercent: GstRate;
  status: MedicineStatus;
};

export const CATEGORY_LABELS: Record<MedicineCategory, string> = {
  tablet_capsule: "Tablets & Capsules",
  syrup_suspension: "Syrups & Suspensions",
  cream_ointment: "Creams & Ointments",
  injection: "Injections",
  drops: "Drops (Eye / Ear / Nasal)",
  inhaler: "Inhalers & Respules",
  sachet_powder: "Sachets & Powders",
  other: "Other",
};

export const PACK_UNIT_LABELS: Record<PackUnit, string> = {
  STP: "STP (Strip)",
  BTL: "BTL (Bottle / Tube / Vial)",
  LSE: "LSE (Loose only)",
  BOX: "BOX (Carton)",
};

/** Loose only when pack supports it */
export function canSellLoose(unit: PackUnit, allowLoose: boolean): boolean {
  return allowLoose && (unit === "STP" || unit === "LSE");
}

/** Table / billing pack text */
export function formatPackLabel(unit: PackUnit, unitsPerPack: number): string {
  const n = unitsPerPack > 0 ? unitsPerPack : 1;
  switch (unit) {
    case "STP":
      return `1 STP = ${n} LSE`;
    case "BOX":
      return `1 BOX = ${n} STP`;
    case "BTL":
      return "1 BTL";
    case "LSE":
      return "1 LSE";
  }
}

export function unitsPerPackHint(unit: PackUnit): string {
  switch (unit) {
    case "STP":
      return "1 STP = N tablets/capsules/sachets";
    case "BOX":
      return "1 BOX = N strips (STP)";
    case "BTL":
      return "Usually 1 for bottle / tube / vial";
    case "LSE":
      return "Usually 1 (single unit)";
  }
}

export function defaultsForCategory(category: MedicineCategory): {
  unit: PackUnit;
  unitsPerStrip: string;
  allowLoose: boolean;
} {
  switch (category) {
    case "tablet_capsule":
      return { unit: "STP", unitsPerStrip: "10", allowLoose: true };
    case "sachet_powder":
      return { unit: "STP", unitsPerStrip: "10", allowLoose: true };
    case "syrup_suspension":
    case "cream_ointment":
    case "injection":
    case "drops":
    case "inhaler":
      return { unit: "BTL", unitsPerStrip: "1", allowLoose: false };
    default:
      return { unit: "BTL", unitsPerStrip: "1", allowLoose: false };
  }
}

/** When user changes pack unit in form */
export function defaultsForPackUnit(unit: PackUnit): {
  unitsPerStrip: string;
  allowLoose: boolean;
} {
  switch (unit) {
    case "STP":
      return { unitsPerStrip: "10", allowLoose: true };
    case "BOX":
      return { unitsPerStrip: "10", allowLoose: false };
    case "LSE":
      return { unitsPerStrip: "1", allowLoose: false };
    case "BTL":
    default:
      return { unitsPerStrip: "1", allowLoose: false };
  }
}

export const emptyMedicineForm = (): MedicineFormValues => ({
  name: "",
  salt: "",
  brand: "",
  category: "tablet_capsule",
  hsn: "",
  barcode: "",
  rack: "",
  unit: "STP",
  unitsPerStrip: "10",
  allowLoose: true,
  mrp: "",
  salePrice: "",
  minStock: "10",
  gstPercent: DEFAULT_GST_RATE,
  status: "active",
});

export function medicineToForm(m: Medicine): MedicineFormValues {
  return {
    name: m.name,
    salt: m.salt,
    brand: m.brand,
    category: m.category,
    hsn: m.hsn,
    barcode: m.barcode,
    rack: m.rack,
    unit: m.unit,
    unitsPerStrip: String(m.unitsPerStrip),
    allowLoose: m.allowLoose,
    mrp: String(m.mrp),
    salePrice: String(m.salePrice),
    minStock: String(m.minStock),
    gstPercent: m.gstPercent,
    status: m.status,
  };
}
