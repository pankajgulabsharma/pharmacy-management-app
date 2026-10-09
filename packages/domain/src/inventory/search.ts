import { createSearch } from "../lib/search";
import { CATEGORY_LABELS } from "../medicines/types";
import type { InventoryBatch } from "./types";

/** Stock rows by medicine (name, salt, brand…), batch no., rack or expiry */
export const inventorySearch = createSearch((b: InventoryBatch) => ({
  name: b.medicineName,
  text: [
    b.salt,
    b.brand,
    b.rack,
    b.expiry,
    b.unit,
    CATEGORY_LABELS[b.category],
  ],
  codes: [b.batchNo, b.hsn],
}));
