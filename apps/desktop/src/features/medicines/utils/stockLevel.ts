import type { MedicineWithStock } from "../types";

export type StockLevel = "ok" | "low" | "out";

/**
 * Stock level of a MEDICINE, from sellable (non-expired) stock only.
 * The same rule everywhere: Medicines, Dashboard, Reports, Inventory.
 *   out  nothing sellable left (expired stock doesn't count)
 *   low  below the minimum (packs; loose units for LSE medicines)
 *   ok   at or above the minimum
 */
export function stockLevel(
  m: Pick<
    MedicineWithStock,
    "unit" | "minStock" | "sellableStrip" | "sellableLoose"
  >,
): StockLevel {
  if (m.sellableStrip <= 0 && m.sellableLoose <= 0) return "out";
  const qty = m.unit === "LSE" ? m.sellableLoose : m.sellableStrip;
  return qty < m.minStock ? "low" : "ok";
}
