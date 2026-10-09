import type { Sale } from "@medicare/domain/billing/types";
import type { Customer } from "@medicare/domain/customers/types";
import type { Medicine } from "@medicare/domain/medicines/types";
import type { Purchase } from "@medicare/domain/purchases/types";
import type { Supplier } from "@medicare/domain/suppliers/types";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { billLookup } from "@medicare/domain/billing/search";
import { customerSearch } from "@medicare/domain/customers/search";
import { medicineSearch } from "@medicare/domain/medicines/search";
import { invoiceLookup } from "@medicare/domain/purchases/search";
import { supplierSearch } from "@medicare/domain/suppliers/search";

export type SearchGroup =
  "Medicines" | "Bills" | "Customers" | "Suppliers" | "Purchases";

export type SearchHit = {
  key: string;
  group: SearchGroup;
  title: string;
  detail: string;
  /** Open this screen… */
  to?: string;
  /** …or show this bill (reprint) */
  saleId?: string;
};

export type SearchData = {
  medicines: readonly Medicine[];
  sales: readonly Sale[];
  customers: readonly Customer[];
  /** Left out for roles that can't open Suppliers / Purchases */
  suppliers?: readonly Supplier[];
  purchases?: readonly Purchase[];
};

const PER_GROUP = 5;
const q = (to: string, text: string) =>
  `${to}?q=${encodeURIComponent(text.slice(0, 60))}`;

/**
 * One search box for the whole shop — the same search as every screen
 * (lib/search): medicines, bills, customers, suppliers, purchases.
 */
export function globalSearch(query: string, d: SearchData): SearchHit[] {
  if (query.replace(/\s/g, "").length < 2) return [];
  const top = { limit: PER_GROUP };
  const hits: SearchHit[] = [];

  for (const m of medicineSearch.filter(d.medicines, query, top))
    hits.push({
      key: `m:${m.id}`,
      group: "Medicines",
      title: m.name,
      detail: [m.salt, m.brand, m.rack && `Rack ${m.rack}`]
        .filter(Boolean)
        .join(" · "),
      to: q("/medicines", m.name),
    });

  for (const s of billLookup.filter(d.sales, query, top))
    hits.push({
      key: `s:${s.id}`,
      group: "Bills",
      title: `${s.billNo} · ${s.customerName}`,
      detail: `${new Date(s.createdAt).toLocaleDateString("en-IN")} · ${inrFromPaise(s.totals.netPaise)}`,
      saleId: s.id,
    });

  for (const c of customerSearch.filter(d.customers, query, top))
    hits.push({
      key: `c:${c.id}`,
      group: "Customers",
      title: c.name,
      detail: c.phone,
      to: q("/customers", c.name),
    });

  for (const s of supplierSearch.filter(d.suppliers ?? [], query, top))
    hits.push({
      key: `p:${s.id}`,
      group: "Suppliers",
      title: s.name,
      detail: s.gstin,
      to: q("/suppliers", s.name),
    });

  for (const p of invoiceLookup.filter(d.purchases ?? [], query, top))
    hits.push({
      key: `i:${p.id}`,
      group: "Purchases",
      title: `${p.invoiceNo} · ${p.supplierName}`,
      detail: `${p.invoiceDate} · ${inrFromPaise(p.totals.netPaise)}`,
      to: q("/purchases", p.invoiceNo),
    });

  return hits;
}
