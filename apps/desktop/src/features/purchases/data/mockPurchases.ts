import { mockMedicines } from "@/features/medicines/data/mockMedicines";
import type { Medicine } from "@/features/medicines/types";
import { addDays, startOfDay, toISODate } from "@/lib/date";
import { rupeesToPaise } from "@/lib/money";
import type { GstRate, Purchase, PurchaseLine, Supplier } from "../types";
import { calcTotals } from "../utils/calc";
import { getDueDate } from "../utils/draft";
import { mockSuppliers } from "@/features/suppliers/data/mockSuppliers";

/**
 * Demo purchase invoices.
 *
 * Generated with a seeded random generator, so the data is identical on
 * every reload, and dated relative to today, so the Due / Overdue / Paid
 * mix always looks realistic whenever the app is opened.
 *
 * TODO(api): delete this file once purchases come from the backend.
 */

const INVOICE_COUNT = 60;
/** Invoices are spread over roughly the last 6 months */
const SPREAD_DAYS = 180;
const SEED = 20260917;
/**
 * The newest N invoices were "entered in this app", so their goods are in
 * inventory and they can be edited, cancelled and returned. Older ones are
 * history imported without stock (read-only) — like a shop migrating from
 * paper or older software.
 */
export const STOCK_POSTED_COUNT = 8;

/** mulberry32 — tiny deterministic PRNG */
function createRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = createRandom(SEED);
const int = (min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1));
const pick = <T>(list: readonly T[]): T =>
  list[Math.floor(rand() * list.length)];
const chance = (p: number) => rand() < p;

/** GST slab by category (demo only — real rate depends on HSN) */
function gstFor(m: Medicine): GstRate {
  if (m.category === "other") return 18;
  if (m.category === "syrup_suspension" || m.category === "cream_ointment") {
    return chance(0.5) ? 12 : 5;
  }
  return 5;
}

function batchPrefix(m: Medicine) {
  return (
    m.name
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 2)
      .toUpperCase() || "BT"
  );
}

/** "MM/YY", 14–36 months after the invoice date */
function expiryAfter(invoiceDate: Date) {
  const d = new Date(
    invoiceDate.getFullYear(),
    invoiceDate.getMonth() + int(14, 36),
    1,
  );
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear() % 100).padStart(2, "0")}`;
}

function makeLine(m: Medicine, invoiceDate: Date, id: string): PurchaseLine {
  const gstPercent = gstFor(m);
  const discountPercent = chance(0.35) ? pick([1, 2, 2.5, 3, 5]) : 0;

  // Purchase rate (excl. GST) = 55–72% of the GST-exclusive MRP, so cost
  // including GST always stays below MRP — like real distributor margins.
  const mrpExGst = m.mrp / (1 + gstPercent / 100);
  const rate = Math.round(mrpExGst * (0.55 + rand() * 0.17) * 100) / 100;

  const qty =
    m.unit === "BTL"
      ? int(6, 36)
      : m.unit === "BOX"
        ? int(2, 10)
        : int(10, 120);
  const freeQty = chance(0.4)
    ? Math.max(1, Math.round(qty / pick([10, 12, 15])))
    : 0;

  return {
    id,
    medicineId: m.id,
    medicineName: m.name,
    brand: m.brand,
    hsn: m.hsn,
    unit: m.unit,
    unitsPerStrip: m.unitsPerStrip,
    batchNo: `${batchPrefix(m)}${int(1000, 9999)}${String.fromCharCode(65 + int(0, 25))}`,
    expiry: expiryAfter(invoiceDate),
    qty,
    freeQty,
    ratePaise: rupeesToPaise(rate),
    mrpPaise: rupeesToPaise(m.mrp),
    discountPercent,
    gstPercent,
  };
}

const NOTES = [
  "Balance after cheque clearance",
  "2 strips damaged — credit note promised",
  "Scheme: 10+1 on fast movers",
  "Delivered late, checked against PO",
  "Rate difference to be adjusted next bill",
  "Cold-chain items checked on arrival",
];

const PREFIX: Record<string, string> = {
  s1: "SGP/26-27/",
  s2: "OSM-",
  s3: "BDH/",
  s4: "NHL-",
  s5: "MPT/",
  s6: "SMD-",
  s7: "ASP/",
  s8: "JAM-",
};

/**
 * Older invoices are mostly settled; recent ones are mostly unpaid —
 * which naturally produces Paid, Partial, Due and Overdue rows.
 */
function paidFor(netPaise: number, ageDays: number, s: Supplier): number {
  const pastDue = ageDays > s.creditDays;
  const r = rand();
  if (pastDue) {
    if (r < 0.68) return netPaise; // paid
    if (r < 0.84) return Math.round((netPaise * int(30, 70)) / 100 / 100) * 100; // partial → overdue
    return 0; // overdue
  }
  if (r < 0.25) return netPaise;
  if (r < 0.6) return Math.round((netPaise * int(20, 60)) / 100 / 100) * 100;
  return 0;
}

function generate(): Purchase[] {
  const today = startOfDay(new Date());
  const medicines = mockMedicines.filter((m) => m.status === "active");
  const counters: Record<string, number> = {};
  const out: Purchase[] = [];

  for (let i = 0; i < INVOICE_COUNT; i++) {
    const supplier = pick(mockSuppliers);
    // Evenly spread with a little jitter; newest first
    const ageDays = Math.max(
      0,
      Math.round((i / INVOICE_COUNT) * SPREAD_DAYS) + int(-2, 2),
    );
    const invoiceDate = addDays(today, -ageDays);
    const invoiceISO = toISODate(invoiceDate);

    // 2–7 distinct medicines per invoice
    const lineCount = int(2, 7);
    const chosen = new Set<Medicine>();
    while (chosen.size < Math.min(lineCount, medicines.length)) {
      chosen.add(pick(medicines));
    }
    const lines = [...chosen].map((m, n) =>
      makeLine(m, invoiceDate, `pl_${i + 1}_${n + 1}`),
    );

    const totals = calcTotals(lines);
    counters[supplier.id] =
      (counters[supplier.id] ?? 1000 + int(0, 400)) + int(3, 25);

    const createdAt = `${invoiceISO}T${String(int(9, 20)).padStart(2, "0")}:${String(int(0, 59)).padStart(2, "0")}:00`;
    const stockPosted = i < STOCK_POSTED_COUNT;

    out.push({
      id: `pur_${String(INVOICE_COUNT - i).padStart(3, "0")}`,
      status: "active",
      stockPosted,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierGstin: supplier.gstin,
      invoiceNo: `${PREFIX[supplier.id] ?? "INV-"}${counters[supplier.id]}`,
      invoiceDate: invoiceISO,
      dueDate: getDueDate(invoiceISO, supplier.creditDays),
      createdAt,
      updatedAt: createdAt,
      revision: 1,
      lines,
      notes: chance(0.2) ? pick(NOTES) : "",
      paidPaise: paidFor(totals.netPaise, ageDays, supplier),
      returnedPaise: 0,
      totals,
    });
  }

  return out;
}

export const mockPurchases: Purchase[] = generate();
