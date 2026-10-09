import { createSearch } from "../lib/search";
import type { Purchase, PurchaseReturn } from "./types";

/** Purchase invoices by supplier, invoice no., date, medicine or batch */
export const purchaseSearch = createSearch((p: Purchase) => ({
  name: p.supplierName,
  text: [p.notes, ...p.lines.flatMap((l) => [l.medicineName, l.brand])],
  codes: [
    p.invoiceNo,
    p.supplierGstin,
    p.invoiceDate,
    ...p.lines.map((l) => l.batchNo),
  ],
}));

/** Debit notes by supplier, number, invoice, medicine or batch */
export const purchaseReturnSearch = createSearch((r: PurchaseReturn) => ({
  name: r.supplierName,
  text: [r.notes, ...r.lines.map((l) => l.medicineName)],
  codes: [
    r.returnNo,
    r.invoiceNo,
    r.supplierGstin,
    ...r.lines.map((l) => l.batchNo),
  ],
}));

/** Header search: purchases by invoice no. or supplier only */
export const invoiceLookup = createSearch((p: Purchase) => ({
  name: p.supplierName,
  codes: [p.invoiceNo],
}));
