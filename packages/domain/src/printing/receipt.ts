/**
 * The printed bill, as ONE complete HTML page per paper size. The same page
 * is shown on screen (preview) and sent to the printer, so what you see is
 * exactly what prints — on a thermal roll, an inkjet/laser on A4/A5, or a
 * dot-matrix through its Windows driver.
 */
import { PAYMENT_METHOD_LABELS, type Sale } from "../billing/types";
import { formatPaise } from "../lib/money";
import type { ShopProfile } from "../settings/types";
import { rupeesInWords } from "./words";

export type PaperFormat = "thermal58" | "thermal80" | "a5" | "a4";

export const PAPER_FORMATS: Record<
  PaperFormat,
  { label: string; hint: string; widthMm: number }
> = {
  thermal80: {
    label: "Thermal 80 mm (3 inch)",
    hint: "Most common billing printer (TVS, Epson TM, Rugtek, Everycom…)",
    widthMm: 80,
  },
  thermal58: {
    label: "Thermal 58 mm (2 inch)",
    hint: "Small / portable thermal printers",
    widthMm: 58,
  },
  a5: {
    label: "A5 (half page)",
    hint: "Laser / inkjet / dot-matrix — half A4 sheet",
    widthMm: 148,
  },
  a4: {
    label: "A4 (full GST tax invoice)",
    hint: "Laser / inkjet / dot-matrix — full sheet",
    widthMm: 210,
  },
};

export const isThermal = (f: PaperFormat) =>
  f === "thermal58" || f === "thermal80";

/** Everything printed is escaped — a customer name can never inject markup */
export const esc = (s: string | number | null | undefined) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const money = (p: number) => formatPaise(p);
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const qtyText = (l: Sale["lines"][number]) =>
  [
    l.qtyStrip ? `${l.qtyStrip} ${l.unit}` : "",
    l.qtyLoose ? `${l.qtyLoose} LSE` : "",
  ]
    .filter(Boolean)
    .join(" + ");

const batchText = (l: Sale["lines"][number]) =>
  l.allocations.map((a) => `${a.batchNo} (${a.expiry})`).join(", ");

/** One GST row per rate: taxable value + CGST/SGST halves */
export function gstSummary(sale: Sale) {
  const by = new Map<number, { taxable: number; gst: number }>();
  for (const l of sale.lines) {
    const r = by.get(l.gstPercent) ?? { taxable: 0, gst: 0 };
    r.taxable += l.taxablePaise;
    r.gst += l.gstPaise;
    by.set(l.gstPercent, r);
  }
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, r]) => {
      const cgst = Math.floor(r.gst / 2);
      return { rate, taxable: r.taxable, cgst, sgst: r.gst - cgst, gst: r.gst };
    });
}

function paymentRows(sale: Sale): [string, string][] {
  const p = sale.payment;
  const rows: [string, string][] = [
    ["Paid by", PAYMENT_METHOD_LABELS[p.method]],
  ];
  if (p.method === "cash" && p.receivedPaise) {
    rows.push(
      ["Received", money(p.receivedPaise)],
      ["Change", money(p.changePaise)],
    );
  }
  if (p.split)
    rows.push([
      "Split",
      `Cash ${money(p.split.cashPaise)} / UPI ${money(p.split.upiPaise)} / Card ${money(p.split.cardPaise)}`,
    ]);
  if (p.reference) rows.push(["Ref", p.reference]);
  return rows;
}

export type ReceiptInput = {
  sale: Sale;
  shop: ShopProfile;
  footer: string;
  format: PaperFormat;
};

export function receiptHtml(input: ReceiptInput): string {
  return isThermal(input.format) ? thermal(input) : sheet(input);
}

function page(title: string, css: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${body}</body></html>`;
}

/* ---------------- Thermal roll (58 / 80 mm) ---------------- */

function thermal({ sale, shop, footer, format }: ReceiptInput) {
  const narrow = format === "thermal58";
  const w = narrow ? 48 : 72; // printable width of the roll
  const t = sale.totals;
  const kv = (k: string, v: string, cls = "") =>
    `<div class="kv ${cls}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;
  const items = sale.lines
    .map(
      (l) => `<div class="item">
  <div class="name">${esc(l.medicineName)}</div>
  <div class="sub">${esc(batchText(l))}${l.hsn ? ` · HSN ${esc(l.hsn)}` : ""} · GST ${l.gstPercent}%${l.discountPercent ? ` · ${l.discountPercent}% off` : ""}</div>
  <div class="kv"><span>${esc(qtyText(l))}</span><span>${money(l.amountPaise)}</span></div>
</div>`,
    )
    .join("");
  const css = `
@page { margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; padding: 2mm ${narrow ? 1.5 : 3}mm; width: ${w + (narrow ? 3 : 6)}mm; font-family: "Courier New", Consolas, monospace; font-size: ${narrow ? 9 : 10.5}px; line-height: 1.3; color: #000; background: #fff; }
.c { text-align: center; } .b { font-weight: 700; }
.shop { font-size: ${narrow ? 12 : 14}px; font-weight: 700; }
.rule { border-top: 1px dashed #000; margin: 4px 0; }
.kv { display: flex; justify-content: space-between; gap: 6px; }
.kv span:last-child { text-align: right; }
.item { margin: 3px 0; } .name { font-weight: 700; } .sub { font-size: ${narrow ? 8 : 9}px; }
.total { font-size: ${narrow ? 12 : 14}px; font-weight: 700; margin-top: 2px; }
.small { font-size: ${narrow ? 8 : 9}px; } .foot { white-space: pre-line; text-align: center; margin-top: 4px; }`;
  const body = `
<div class="c"><div class="shop">${esc(shop.name)}</div>
<div>${esc(shop.address)}</div><div>Ph ${esc(shop.phone)}</div>
${shop.gstin ? `<div>GSTIN ${esc(shop.gstin)}</div>` : ""}<div>DL ${esc(shop.drugLicense)}</div>
<div class="b" style="margin-top:3px">TAX INVOICE</div></div>
<div class="rule"></div>
${kv("Bill", sale.billNo)}${kv("Date", when(sale.createdAt))}${kv("Customer", sale.customerName)}
${sale.doctor ? kv("Doctor", sale.doctor) : ""}${sale.counter ? kv("Counter", sale.counter) : ""}${sale.billedBy ? kv("Billed by", sale.billedBy) : ""}
<div class="rule"></div>${items}<div class="rule"></div>
${kv("Items", String(sale.lines.length))}${kv("Subtotal", money(t.grossPaise))}
${t.discountPaise ? kv("Discount", `-${money(t.discountPaise)}`) : ""}
${kv("Taxable value", money(t.taxablePaise))}${kv("CGST", money(t.cgstPaise))}${kv("SGST", money(t.sgstPaise))}
${t.roundOffPaise ? kv("Round off", `${t.roundOffPaise > 0 ? "+" : "-"}${money(Math.abs(t.roundOffPaise))}`) : ""}
${kv("TOTAL", `Rs ${money(t.netPaise)}`, "total")}
<div class="small">(Prices include GST)</div>
<div class="rule"></div>${paymentRows(sale)
    .map(([k, v]) => kv(k, v))
    .join("")}
<div class="rule"></div>${footer ? `<div class="foot">${esc(footer)}</div>` : ""}`;
  return page(`Bill ${sale.billNo}`, css, body);
}

/* ---------------- Full sheet (A4 / A5) ---------------- */

function sheet({ sale, shop, footer, format }: ReceiptInput) {
  const a5 = format === "a5";
  const t = sale.totals;
  const rows = sale.lines
    .map((l, i) => {
      const a = l.allocations;
      const mrp = a.length ? money(a[0].mrpPaise) : "";
      const rate = a.length ? money(a[0].ratePaise) : "";
      return `<tr>
<td class="r">${i + 1}</td>
<td><b>${esc(l.medicineName)}</b>${l.brand ? `<div class="mut">${esc(l.brand)}</div>` : ""}</td>
<td>${esc(l.hsn)}</td>
<td>${esc(a.map((x) => x.batchNo).join(", "))}</td>
<td>${esc(a.map((x) => x.expiry).join(", "))}</td>
<td class="r">${esc(qtyText(l))}</td>
<td class="r">${mrp}</td>
<td class="r">${rate}</td>
<td class="r">${l.discountPercent ? `${l.discountPercent}%` : "-"}</td>
<td class="r">${l.gstPercent}%</td>
<td class="r">${money(l.amountPaise)}</td></tr>`;
    })
    .join("");
  const gst = gstSummary(sale)
    .map(
      (g) =>
        `<tr><td>${g.rate}%</td><td class="r">${money(g.taxable)}</td><td class="r">${money(g.cgst)}</td><td class="r">${money(g.sgst)}</td><td class="r">${money(g.gst)}</td></tr>`,
    )
    .join("");
  const totals: [string, string][] = [
    ["Subtotal", money(t.grossPaise)],
    ...(t.discountPaise
      ? ([["Discount", `-${money(t.discountPaise)}`]] as [string, string][])
      : []),
    ["Taxable value", money(t.taxablePaise)],
    ["CGST", money(t.cgstPaise)],
    ["SGST", money(t.sgstPaise)],
    ...(t.roundOffPaise
      ? ([
          [
            "Round off",
            `${t.roundOffPaise > 0 ? "+" : "-"}${money(Math.abs(t.roundOffPaise))}`,
          ],
        ] as [string, string][])
      : []),
  ];
  const css = `
@page { size: ${a5 ? "A5" : "A4"}; margin: ${a5 ? 8 : 12}mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: ${a5 ? 9 : 10.5}px; color: #000; background: #fff; }
.head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #000; padding-bottom: 6px; }
.shop { font-size: ${a5 ? 15 : 19}px; font-weight: 700; }
.title { font-size: ${a5 ? 12 : 14}px; font-weight: 700; text-align: right; letter-spacing: 1px; }
.meta { display: flex; justify-content: space-between; gap: 16px; margin: 6px 0; }
table { width: 100%; border-collapse: collapse; }
.items th, .items td { border: 1px solid #000; padding: 3px 4px; vertical-align: top; }
.items th { background: #eee; font-size: ${a5 ? 8 : 9}px; text-transform: uppercase; }
.r { text-align: right; white-space: nowrap; } .mut { color: #333; font-size: ${a5 ? 8 : 9}px; }
.bottom { display: flex; justify-content: space-between; gap: 16px; margin-top: 8px; }
.gst th, .gst td { border: 1px solid #000; padding: 2px 4px; font-size: ${a5 ? 8 : 9}px; }
.tot { min-width: 45%; } .tot td { padding: 2px 4px; }
.net td { font-size: ${a5 ? 12 : 14}px; font-weight: 700; border-top: 2px solid #000; }
.words { margin-top: 6px; font-weight: 700; }
.sign { display: flex; justify-content: space-between; margin-top: ${a5 ? 22 : 36}px; }
.foot { white-space: pre-line; margin-top: 8px; font-size: ${a5 ? 8 : 9}px; }
tr { page-break-inside: avoid; }`;
  const body = `
<div class="head"><div>
<div class="shop">${esc(shop.name)}</div><div>${esc(shop.address)}</div>
<div>Ph ${esc(shop.phone)}${shop.email ? ` · ${esc(shop.email)}` : ""}</div>
<div>${shop.gstin ? `GSTIN ${esc(shop.gstin)} · ` : ""}DL ${esc(shop.drugLicense)}</div></div>
<div><div class="title">TAX INVOICE</div>
<div class="r">Bill <b>${esc(sale.billNo)}</b></div><div class="r">${esc(when(sale.createdAt))}</div></div></div>
<div class="meta"><div><b>Patient / Customer:</b> ${esc(sale.customerName)}${sale.doctor ? `<br><b>Prescribed by:</b> ${esc(sale.doctor)}` : ""}</div>
<div class="r">${sale.counter ? `Counter: ${esc(sale.counter)}<br>` : ""}${sale.billedBy ? `Billed by: ${esc(sale.billedBy)}` : ""}</div></div>
<table class="items"><thead><tr><th>#</th><th>Product</th><th>HSN</th><th>Batch</th><th>Exp</th><th>Qty</th><th>MRP</th><th>Rate</th><th>Disc</th><th>GST</th><th>Amount</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="bottom"><div>
<table class="gst"><thead><tr><th>GST</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>Total GST</th></tr></thead><tbody>${gst}</tbody></table>
<div style="margin-top:6px">${paymentRows(sale)
    .map(([k, v]) => `${esc(k)}: <b>${esc(v)}</b>`)
    .join(" · ")}</div></div>
<table class="tot">${totals.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${v}</td></tr>`).join("")}
<tr class="net"><td>Net amount</td><td class="r">Rs ${money(t.netPaise)}</td></tr></table></div>
<div class="words">${esc(rupeesInWords(t.netPaise))}</div>
<div class="sign"><div>Customer's signature</div><div>For ${esc(shop.name)}<br><br>Pharmacist / Authorised signatory</div></div>
${footer ? `<div class="foot">${esc(footer)}</div>` : ""}`;
  return page(`Bill ${sale.billNo}`, css, body);
}
