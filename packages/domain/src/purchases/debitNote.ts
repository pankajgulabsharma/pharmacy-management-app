/**
 * Debit note print (A4) — goes with the goods back to the distributor.
 * One note, or a whole expiry return (several notes, one per invoice) on
 * one sheet: items, batch, expiry, quantity, rate, GST and the credit
 * asked for, signed by both sides.
 */
import { formatPaise } from "../lib/money";
import { formatPackLabel, type PackUnit } from "../medicines/types";
import { esc } from "../printing/receipt";
import type { ReportShop } from "../cash/dayReport";
import { RETURN_REASONS, type PurchaseReturn } from "./types";

export type DebitNoteParty = {
  name: string;
  gstin?: string;
  address?: string;
  phone?: string;
  drugLicenseNo?: string;
};

const rs = (p: number) => `₹${formatPaise(p)}`;
const day = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export function debitNoteHtml(input: {
  shop: ReportShop & { drugLicenseNo?: string };
  supplier: DebitNoteParty;
  returns: readonly PurchaseReturn[];
}): string {
  const { shop, supplier, returns } = input;
  const one = returns.length === 1;
  const first = returns[0];
  const lines = returns.flatMap((r) => r.lines.map((l) => ({ r, l })));
  const total = returns.reduce((a, r) => a + r.totalPaise, 0);
  const gst = returns.reduce((a, r) => a + r.gstPaise, 0);
  const qty = returns.reduce((a, r) => a + r.totalQty, 0);
  const reasons = [...new Set(returns.map((r) => RETURN_REASONS[r.reason]))];
  const party = (p: DebitNoteParty, label: string) =>
    `<div class=party><div class=lbl>${label}</div><b>${esc(p.name)}</b>${
      p.address ? `<div>${esc(p.address)}</div>` : ""
    }${p.phone ? `<div>Ph. ${esc(p.phone)}</div>` : ""}${
      p.gstin ? `<div>GSTIN ${esc(p.gstin)}</div>` : ""
    }${p.drugLicenseNo ? `<div>D.L. ${esc(p.drugLicenseNo)}</div>` : ""}</div>`;

  const rows = lines
    .map(
      ({ r, l }, i) =>
        `<tr><td>${i + 1}</td><td>${esc(l.medicineName)}<small>${esc(
          formatPackLabel(l.unit as PackUnit, l.unitsPerStrip),
        )}</small></td><td>${esc(l.batchNo)}</td><td>${esc(l.expiry)}</td>${
          one ? "" : `<td>${esc(r.invoiceNo)}</td>`
        }<td class=r>${l.qty} ${esc(l.unit)}</td><td class=r>${formatPaise(
          l.ratePaise,
        )}</td><td class=r>${l.gstPercent}%</td><td class=r>${formatPaise(
          l.amountPaise,
        )}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset=utf-8><title>${esc(
    one ? first.returnNo : `Expiry return · ${supplier.name}`,
  )}</title><style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box}body{font:11px/1.4 system-ui,Segoe UI,Arial,sans-serif;color:#000;margin:0}
.head{text-align:center;border-bottom:2px solid #000;padding-bottom:6px}
.head h1{font-size:16px;margin:0}.muted{color:#555}
.bar{background:#000;color:#fff;text-align:center;font-weight:700;letter-spacing:.08em;padding:4px;margin:8px 0}
.parties{display:flex;gap:12px}.party{flex:1;border:1px solid #999;padding:6px 8px}
.lbl{font-size:9.5px;text-transform:uppercase;color:#555;letter-spacing:.04em}
.meta{display:flex;flex-wrap:wrap;gap:4px 18px;margin:8px 0}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{padding:4px 6px;border-bottom:1px solid #ccc;text-align:left;vertical-align:top}
th{font-size:10px;text-transform:uppercase;border-bottom:1.5px solid #000;border-top:1.5px solid #000}
.r{text-align:right}small{display:block;color:#666;font-size:9.5px}
.tot{width:300px;margin:8px 0 0 auto}.tot td{border:0;padding:2px 6px}.tot .g td{border-top:1.5px solid #000;border-bottom:3px double #000;font-weight:700;font-size:12px}
.note{margin-top:10px;border:1px dashed #999;padding:6px 8px}
.sign{display:flex;justify-content:space-between;margin-top:44px}.sign div{width:220px;border-top:1px solid #000;padding-top:3px;text-align:center}
tr{page-break-inside:avoid}
</style></head><body>
<div class=head><h1>${esc(shop.name)}</h1><div class=muted>${esc(
    [
      shop.address,
      shop.phone ? `Ph. ${shop.phone}` : "",
      shop.gstin ? `GSTIN ${shop.gstin}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  )}</div></div>
<div class=bar>DEBIT NOTE${one ? "" : "S"} — GOODS RETURNED</div>
<div class=parties>${party(
    { ...shop, drugLicenseNo: shop.drugLicenseNo },
    "From (buyer)",
  )}${party(supplier, "To (supplier)")}</div>
<div class=meta>
<span><b>${one ? "Debit note" : "Debit notes"}:</b> ${esc(
    returns.map((r) => r.returnNo).join(", "),
  )}</span>
<span><b>Date:</b> ${esc(day(first.date))}</span>
${one ? `<span><b>Against invoice:</b> ${esc(first.invoiceNo)}</span>` : ""}
<span><b>Reason:</b> ${esc(reasons.join(", "))}</span>
</div>
<table><thead><tr><th>#</th><th>Item</th><th>Batch</th><th>Exp.</th>${
    one ? "" : "<th>Invoice</th>"
  }<th class=r>Qty</th><th class=r>Rate</th><th class=r>GST</th><th class=r>Amount</th></tr></thead><tbody>${rows}</tbody></table>
<table class=tot>
<tr><td>Items / quantity</td><td class=r>${lines.length} / ${qty}</td></tr>
<tr><td>Taxable value</td><td class=r>${rs(total - gst)}</td></tr>
<tr><td>GST included</td><td class=r>${rs(gst)}</td></tr>
<tr class=g><td>Credit due to us</td><td class=r>${rs(total)}</td></tr>
</table>
${first.notes ? `<div class=note><b>Note:</b> ${esc(first.notes)}</div>` : ""}
<p class=muted>Rates are as charged on the original invoice (incl. GST). Please issue a credit note for the amount above.</p>
<div class=sign><div>Received by (supplier)</div><div>For ${esc(shop.name)}</div></div>
</body></html>`;
}
