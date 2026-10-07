import type { Sale } from "@medicare/domain/billing/types";
import type { Customer } from "@medicare/domain/customers/types";
import type { Medicine } from "@medicare/domain/medicines/types";
import type { Purchase } from "@medicare/domain/purchases/types";
import type { Supplier } from "@medicare/domain/suppliers/types";
import { inrFromPaise } from "@medicare/domain/lib/money";

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
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const q = (to: string, text: string) =>
  `${to}?q=${encodeURIComponent(text.slice(0, 60))}`;

/**
 * Items whose text contains every word typed (any order). Best first:
 * the main name starting with what was typed, then the name containing
 * it, then other fields (salt, phone, GSTIN…). Otherwise list order.
 */
function pick<T>(
  list: readonly T[],
  words: string[],
  text: (x: T) => string,
  name: (x: T) => string,
): T[] {
  const scored: { x: T; rank: number; i: number }[] = [];
  list.forEach((x, i) => {
    if (!words.every((w) => norm(text(x)).includes(w))) return;
    const n = norm(name(x));
    const rank = n.startsWith(words[0])
      ? 0
      : words.every((w) => n.includes(w))
        ? 1
        : 2;
    scored.push({ x, rank, i });
  });
  return scored
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, PER_GROUP)
    .map((s) => s.x);
}

/**
 * One search box for the whole shop. Medicines by name / salt / brand /
 * barcode; bills by number or customer (newest first); customers by name
 * or mobile; suppliers by name or GSTIN; purchases by invoice no.
 */
export function globalSearch(query: string, d: SearchData): SearchHit[] {
  const words = norm(query).split(" ").filter(Boolean);
  if (words.join("").length < 2) return [];
  const hits: SearchHit[] = [];

  for (const m of pick(
    d.medicines,
    words,
    (m) => `${m.name} ${m.salt} ${m.brand} ${m.barcode}`,
    (m) => m.name,
  ))
    hits.push({
      key: `m:${m.id}`,
      group: "Medicines",
      title: m.name,
      detail: [m.salt, m.brand, m.rack && `Rack ${m.rack}`]
        .filter(Boolean)
        .join(" · "),
      to: q("/medicines", m.name),
    });

  for (const s of pick(
    d.sales,
    words,
    (s) => `${s.billNo} ${s.customerName}`,
    (s) => s.billNo,
  ))
    hits.push({
      key: `s:${s.id}`,
      group: "Bills",
      title: `${s.billNo} · ${s.customerName}`,
      detail: `${new Date(s.createdAt).toLocaleDateString("en-IN")} · ${inrFromPaise(s.totals.netPaise)}`,
      saleId: s.id,
    });

  for (const c of pick(
    d.customers,
    words,
    (c) => `${c.name} ${c.phone}`,
    (c) => c.name,
  ))
    hits.push({
      key: `c:${c.id}`,
      group: "Customers",
      title: c.name,
      detail: c.phone,
      to: q("/customers", c.name),
    });

  for (const s of pick(
    d.suppliers ?? [],
    words,
    (s) => `${s.name} ${s.gstin}`,
    (s) => s.name,
  ))
    hits.push({
      key: `p:${s.id}`,
      group: "Suppliers",
      title: s.name,
      detail: s.gstin,
      to: q("/suppliers", s.name),
    });

  for (const p of pick(
    d.purchases ?? [],
    words,
    (p) => `${p.invoiceNo} ${p.supplierName}`,
    (p) => p.invoiceNo,
  ))
    hits.push({
      key: `i:${p.id}`,
      group: "Purchases",
      title: `${p.invoiceNo} · ${p.supplierName}`,
      detail: `${p.invoiceDate} · ${inrFromPaise(p.totals.netPaise)}`,
      to: q("/purchases", p.invoiceNo),
    });

  return hits;
}
