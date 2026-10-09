import { createSearch } from "../lib/search";
import { CATEGORY_LABELS, type Medicine } from "./types";

/** Medicines by name, salt, brand, form, rack, HSN or barcode */
export const medicineSearch = createSearch((m: Medicine) => ({
  name: m.name,
  text: [m.salt, m.brand, m.rack, m.unit, CATEGORY_LABELS[m.category]],
  codes: [m.barcode, m.hsn],
}));
