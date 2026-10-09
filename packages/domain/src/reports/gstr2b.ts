/**
 * GSTR-2B match — "did my suppliers report the bills I entered?"
 *
 * The shop downloads its GSTR-2B JSON from the GST portal (free: Returns →
 * GSTR-2B → Download → JSON) and opens it here. Every supplier bill in it
 * is matched with the purchases entered in MediCare by supplier GSTIN +
 * invoice number:
 *
 *   matched       same bill, same tax (within ₹1)
 *   tax differs   same bill, different GST → check with the supplier
 *   not in books  supplier reported it, we never entered it
 *   not in 2B     we entered it, the supplier hasn't reported it yet —
 *                 its GST credit (ITC) can't be taken until they do
 */
import type { Purchase } from "../purchases/types";

export type TwoBInvoice = {
  gstin: string;
  supplier: string;
  invoiceNo: string;
  /** "YYYY-MM-DD" */
  date: string;
  valuePaise: number;
  taxablePaise: number;
  gstPaise: number;
  /** ITC available as per 2B ("N" = not eligible) */
  itc: boolean;
};

export type TwoB = {
  /** "092026" = September 2026 */
  period: string;
  invoices: TwoBInvoice[];
};

export type MatchStatus =
  "matched" | "tax_differs" | "not_in_books" | "not_in_2b";

export type MatchRow = {
  status: MatchStatus;
  gstin: string;
  supplier: string;
  invoiceNo: string;
  date: string;
  /** Tax as per 2B / as per our books (paise; null = missing there) */
  gst2b: number | null;
  gstBooks: number | null;
  purchaseId?: string;
};

export const MATCH_LABELS: Record<MatchStatus, string> = {
  matched: "Matched",
  tax_differs: "Tax differs",
  not_in_books: "Not entered in MediCare",
  not_in_2b: "Supplier hasn't reported (no ITC yet)",
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const paise = (rupees: unknown) => Math.round(num(rupees) * 100);

/** "15-10-2026" → "2026-10-15" */
const ymd = (dmy: unknown) => {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(dmy ?? ""));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

/**
 * Reads the GSTR-2B JSON from the portal (any of its wrappings). Throws a
 * plain message if it isn't one.
 */
export function parseGstr2b(text: string): TwoB {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error("This is not a GSTR-2B JSON file");
  }
  // { data: { docdata } }, { data: { data: { docdata } } } or { docdata }
  let body = obj(j);
  for (let i = 0; i < 3 && !body.docdata; i++) body = obj(body.data);
  if (!body.docdata) throw new Error("This is not a GSTR-2B JSON file");
  const doc = obj(body.docdata);
  const invoices: TwoBInvoice[] = [];
  for (const sup of arr(doc.b2b)) {
    const s = obj(sup);
    for (const inv of arr(s.inv)) {
      const v = obj(inv);
      let taxable = 0;
      let gst = 0;
      for (const it of arr(v.items)) {
        const x = obj(it);
        taxable += paise(x.txval);
        gst += paise(x.igst) + paise(x.cgst) + paise(x.sgst) + paise(x.cess);
      }
      invoices.push({
        gstin: String(s.ctin ?? "").toUpperCase(),
        supplier: String(s.trdnm ?? ""),
        invoiceNo: String(v.inum ?? ""),
        date: ymd(v.dt),
        valuePaise: paise(v.val),
        taxablePaise: taxable,
        gstPaise: gst,
        itc: String(v.itcavl ?? "Y") !== "N",
      });
    }
  }
  return { period: String(body.rtnprd ?? ""), invoices };
}

/** "INV/0042", "inv-42", "0042" → "INV42" style key (suppliers type them differently) */
export const invoiceKey = (gstin: string, no: string) =>
  `${gstin.toUpperCase()}|${no
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/(^|[A-Z])0+(?=\d)/g, "$1")}`;

/** Purchases of the 2B's month (by invoice date) that need a match */
function inPeriod(p: Purchase, period: string) {
  if (!/^\d{6}$/.test(period)) return true;
  return (
    p.invoiceDate.slice(0, 7) === `${period.slice(2)}-${period.slice(0, 2)}`
  );
}

export function matchGstr2b(
  twoB: TwoB,
  purchases: readonly Purchase[],
): MatchRow[] {
  const books = new Map<string, Purchase>();
  for (const p of purchases)
    if (p.status !== "cancelled" && p.supplierGstin)
      books.set(invoiceKey(p.supplierGstin, p.invoiceNo), p);

  const rows: MatchRow[] = [];
  const seen = new Set<string>();
  for (const inv of twoB.invoices) {
    const key = invoiceKey(inv.gstin, inv.invoiceNo);
    const p = books.get(key);
    seen.add(key);
    const base = {
      gstin: inv.gstin,
      supplier: p?.supplierName || inv.supplier,
      invoiceNo: inv.invoiceNo,
      date: inv.date,
      gst2b: inv.gstPaise,
    };
    if (!p) rows.push({ ...base, status: "not_in_books", gstBooks: null });
    else
      rows.push({
        ...base,
        status:
          Math.abs(p.totals.gstPaise - inv.gstPaise) <= 100
            ? "matched"
            : "tax_differs",
        gstBooks: p.totals.gstPaise,
        purchaseId: p.id,
      });
  }
  for (const [key, p] of books) {
    if (seen.has(key) || !inPeriod(p, twoB.period)) continue;
    rows.push({
      status: "not_in_2b",
      gstin: p.supplierGstin,
      supplier: p.supplierName,
      invoiceNo: p.invoiceNo,
      date: p.invoiceDate,
      gst2b: null,
      gstBooks: p.totals.gstPaise,
      purchaseId: p.id,
    });
  }
  const order: MatchStatus[] = [
    "tax_differs",
    "not_in_2b",
    "not_in_books",
    "matched",
  ];
  return rows.sort(
    (a, b) =>
      order.indexOf(a.status) - order.indexOf(b.status) ||
      a.supplier.localeCompare(b.supplier),
  );
}
