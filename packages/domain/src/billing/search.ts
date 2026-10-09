import { createSearch } from "../lib/search";
import type { Sale } from "./types";

/** Bills by customer, bill no., doctor or a medicine on the bill */
export const saleSearch = createSearch((s: Sale) => ({
  name: s.customerName,
  text: [s.doctor, ...s.lines.map((l) => l.medicineName)],
  codes: [s.billNo],
}));

/** Header search: bills by number or customer only (not every bill with Dolo) */
export const billLookup = createSearch((s: Sale) => ({
  name: s.customerName,
  codes: [s.billNo],
}));
