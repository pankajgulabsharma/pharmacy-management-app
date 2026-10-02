import type { MedicineFormValues } from "../types";

export type FieldErrors = Partial<Record<keyof MedicineFormValues, string>>;

export function validateMedicineForm(v: MedicineFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!v.name.trim()) errors.name = "Name is required";
  else if (v.name.trim().length < 2) errors.name = "Min 2 characters";

  if (!v.brand.trim()) errors.brand = "Brand is required";

  if (!v.hsn.trim()) errors.hsn = "HSN is required";
  else if (!/^\d{4,8}$/.test(v.hsn.trim())) errors.hsn = "HSN: 4–8 digits";

  const ups = Number(v.unitsPerStrip);
  if (!v.unitsPerStrip.trim() || Number.isNaN(ups) || ups < 1 || ups > 500) {
    errors.unitsPerStrip = "Enter 1–500";
  }

  if (v.unit === "STP" && ups < 2) {
    errors.unitsPerStrip = "Strip should have 2+ units";
  }

  if (v.unit === "BOX" && ups < 2) {
    errors.unitsPerStrip = "Box should contain 2+ strips";
  }

  if (v.allowLoose && v.unit !== "STP" && v.unit !== "LSE") {
    errors.allowLoose = "Loose sale only for STP / LSE packs";
  }

  const mrp = Number(v.mrp);
  if (!v.mrp.trim() || Number.isNaN(mrp) || mrp < 0) {
    errors.mrp = "Valid MRP required";
  }

  const sale = Number(v.salePrice);
  if (!v.salePrice.trim() || Number.isNaN(sale) || sale < 0) {
    errors.salePrice = "Valid sale price required";
  } else if (!Number.isNaN(mrp) && sale > mrp) {
    errors.salePrice = "Sale price cannot exceed MRP";
  }

  const minStock = Number(v.minStock);
  if (!v.minStock.trim() || Number.isNaN(minStock) || minStock < 0) {
    errors.minStock = "Valid min stock required";
  }

  return errors;
}
