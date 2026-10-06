import { create } from "zustand";
import { newId } from "@medicare/domain/lib/id";
import { DEFAULT_GST_RATE, isGstRate } from "@medicare/domain/lib/gst";
import { cleanCode, cleanText } from "@medicare/domain/lib/sanitize";
import { mockMedicines } from "../data/mockMedicines";
import type { Medicine, MedicineInput } from "@medicare/domain/medicines/types";

/**
 * Medicine master (catalogue) — single source of truth for product data.
 *
 * Kept in memory on purpose: business data must not live in localStorage
 * (unencrypted, readable by any injected script, not shared across
 * devices). TODO(api): replace the seed + actions with backend calls.
 */
type MedicineState = {
  medicines: Medicine[];
  addMedicine: (input: MedicineInput) => Medicine;
  updateMedicine: (id: string, input: MedicineInput) => void;
  /** Caller must check stock first — see MedicinesPage / MedicineDeleteDialog */
  removeMedicine: (id: string) => void;
  importMedicines: (rows: readonly MedicineInput[]) => number;
};

const MAX_IMPORT = 5000;

function clampNumber(n: number, min: number, max: number, fallback: number) {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Never trust callers: normalise and bound every field before storing */
function sanitize(input: MedicineInput): MedicineInput {
  const loosePossible = input.unit === "STP" || input.unit === "LSE";
  const mrp = clampNumber(input.mrp, 0, 1_000_000, 0);
  return {
    name: cleanText(input.name, 120),
    salt: cleanText(input.salt, 160),
    brand: cleanText(input.brand, 80),
    category: input.category,
    hsn: input.hsn.replace(/\D/g, "").slice(0, 8),
    barcode: cleanCode(input.barcode, 32),
    rack: cleanCode(input.rack, 16),
    unit: input.unit,
    unitsPerStrip: Math.trunc(clampNumber(input.unitsPerStrip, 1, 500, 1)),
    allowLoose: loosePossible ? input.allowLoose : false,
    mrp,
    // Selling above MRP is illegal in India — cap it
    salePrice: Math.min(clampNumber(input.salePrice, 0, 1_000_000, 0), mrp),
    minStock: Math.trunc(clampNumber(input.minStock, 0, 1_000_000, 0)),
    gstPercent: isGstRate(input.gstPercent)
      ? input.gstPercent
      : DEFAULT_GST_RATE,
    status: input.status === "inactive" ? "inactive" : "active",
  };
}

export const useMedicineStore = create<MedicineState>()((set) => ({
  medicines: mockMedicines,

  addMedicine: (input) => {
    const medicine: Medicine = { id: newId("med"), ...sanitize(input) };
    set((s) => ({ medicines: [medicine, ...s.medicines] }));
    return medicine;
  },

  updateMedicine: (id, input) => {
    const clean = sanitize(input);
    set((s) => ({
      medicines: s.medicines.map((m) => (m.id === id ? { ...m, ...clean } : m)),
    }));
  },

  removeMedicine: (id) => {
    set((s) => ({ medicines: s.medicines.filter((m) => m.id !== id) }));
  },

  importMedicines: (rows) => {
    const created = rows
      .slice(0, MAX_IMPORT)
      .map((r): Medicine => ({ id: newId("med"), ...sanitize(r) }));
    set((s) => ({ medicines: [...created, ...s.medicines] }));
    return created.length;
  },
}));
