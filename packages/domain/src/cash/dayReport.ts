/**
 * Galla day report — the till's "Z report": the day's cash in and out,
 * what was counted, short / excess, notes counted, and what was left for
 * tomorrow; signed by the cashier and the owner. Thermal roll (80 mm) or
 * A4 (two columns).
 */
import { formatPaise } from "../lib/money";
import {
  COINS_KEY,
  DIFF_TOLERANCE_PAISE,
  differenceOf,
  NOTES,
  type CashDay,
  type CashEntry,
  type GallaSummary,
} from "./galla";

export type ReportShop = {
  name: string;
  address?: string;
  phone?: string;
  gstin?: string;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const rs = (p: number) => `${p < 0 ? "-" : ""}${formatPaise(Math.abs(p))}`;
const clock = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

export function dayReportHtml(input: {
  shop: ReportShop;
  date: string;
  counter: string;
  day: CashDay | null;
  summary: GallaSummary;
  entries: readonly CashEntry[];
  paper?: "thermal" | "a4";
  printedAt?: Date;
}): string {
  const { day, summary: s, shop } = input;
  const a4 = input.paper === "a4";
  const expected = day?.expectedPaise ?? s.expectedPaise;
  const diff = day ? differenceOf(day) : null;
  const tr = (label: string, value: string, cls = "") =>
    `<tr${cls ? ` class="${cls}"` : ""}><td>${label}</td><td class="r">${value}</td></tr>`;
  const opt = (label: string, p: number, sign: "+" | "-") =>
    p ? tr(`${sign} ${label}`, rs(p)) : "";

  const dateText = new Date(`${input.date}T00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const cash = `
<h2>Cash in galla</h2>
<table>
${tr("Opening cash", rs(s.openingPaise))}
${tr(`+ Cash bills (${s.cashBills})`, rs(s.cashSalesPaise))}
${opt("Udhaar received", s.udhaarCollectedPaise, "+")}
${opt("Other cash in", s.otherInPaise, "+")}
${opt("Cash refunds", s.refundsPaise, "-")}
${opt("Suppliers paid", s.supplierPaidPaise, "-")}
${opt("Expenses &amp; other", s.otherOutPaise, "-")}
${tr("Should be in galla", rs(expected), "total")}
${day?.countedPaise != null ? tr("Counted", rs(day.countedPaise), "b") : ""}
</table>
${
  diff !== null
    ? `<div class="diff ${Math.abs(diff) <= DIFF_TOLERANCE_PAISE ? "ok" : ""}">
<span>${Math.abs(diff) <= DIFF_TOLERANCE_PAISE ? "MATCHES" : diff < 0 ? "SHORT" : "EXCESS"}</span>
<b>Rs ${rs(Math.abs(diff))}</b></div>`
    : ""
}
${
  day?.keptPaise != null && day.countedPaise != null
    ? `<table>${tr("Left for tomorrow", rs(day.keptPaise))}${tr("Taken out (owner / bank)", rs(day.countedPaise - day.keptPaise))}</table>`
    : ""
}`;

  const noteRows = day
    ? NOTES.filter((n) => day.denominations[String(n)])
        .map((n) => {
          const q = day.denominations[String(n)];
          return `<tr><td>Rs ${n}</td><td class="c">${q}</td><td class="r">${rs(n * 100 * q)}</td></tr>`;
        })
        .join("") +
      (day.denominations[COINS_KEY]
        ? `<tr><td>Coins</td><td class="c">—</td><td class="r">${rs(day.denominations[COINS_KEY])}</td></tr>`
        : "")
    : "";
  const notes = noteRows
    ? `<h2>Notes counted</h2>
<table class="grid"><thead><tr><th>Note</th><th class="c">Pcs</th><th class="r">Amount</th></tr></thead>
<tbody>${noteRows}</tbody>
<tfoot><tr><td colspan="2">Total</td><td class="r">${rs(day!.countedPaise ?? 0)}</td></tr></tfoot></table>`
    : "";

  const other = `
<h2>Sales of the day</h2>
<table>
${tr(`All sales (${s.bills} bills)`, rs(s.salesPaise), "b")}
${tr("Cash", rs(s.cashSalesPaise))}
${s.upiPaise ? tr("UPI", rs(s.upiPaise)) : ""}
${s.cardPaise ? tr("Card", rs(s.cardPaise)) : ""}
${s.walletPaise ? tr("Wallet", rs(s.walletPaise)) : ""}
${s.udhaarGivenPaise ? tr("Udhaar given", rs(s.udhaarGivenPaise)) : ""}
</table>`;

  const moves = input.entries.length
    ? `<h2>Cash in / out</h2>
<table class="grid"><thead><tr><th>Time</th><th>Detail</th><th class="r">Amount</th></tr></thead><tbody>
${input.entries
  .map(
    (e) =>
      `<tr><td class="t">${esc(clock(e.at))}</td><td>${esc(e.category)}${e.note ? `<br><small>${esc(e.note)}</small>` : ""}</td><td class="r">${e.kind === "in" ? "+" : "-"}${rs(e.amountPaise)}</td></tr>`,
  )
  .join("")}
</tbody></table>`
    : "";

  const printed = (input.printedAt ?? new Date()).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const css = `
* { box-sizing: border-box; }
@page { margin: ${a4 ? "14mm" : "0"}; }
body { margin: 0; padding: ${a4 ? "0" : "3mm 3.5mm"}; font-family: Arial, Helvetica, sans-serif; color: #000; font-size: ${a4 ? 11.5 : 10.5}px; line-height: 1.35; }
.wrap { ${a4 ? "max-width: 180mm; margin: 0 auto;" : ""} }
header { text-align: center; padding-bottom: ${a4 ? 8 : 5}px; border-bottom: 1px solid #000; }
header h1 { margin: 0; font-size: ${a4 ? 18 : 13.5}px; letter-spacing: .2px; }
header p { margin: 1px 0 0; font-size: ${a4 ? 10.5 : 9.5}px; }
.title { margin: ${a4 ? 10 : 6}px 0 0; background: #000; color: #fff; text-align: center; font-weight: 700; letter-spacing: 2px; font-size: ${a4 ? 12 : 10.5}px; padding: 3px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.meta { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: ${a4 ? 10.5 : 9.5}px; }
.meta td { padding: 1px 0; }
.meta td:nth-child(even) { text-align: right; }
.meta b { font-weight: 700; }
h2 { margin: ${a4 ? 12 : 8}px 0 2px; font-size: ${a4 ? 10.5 : 9.5}px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px dashed #000; padding-bottom: 2px; }
table { width: 100%; border-collapse: collapse; }
td, th { padding: 1.5px 0; vertical-align: top; }
th { text-align: left; font-size: ${a4 ? 9.5 : 8.5}px; text-transform: uppercase; letter-spacing: .5px; border-bottom: 1px solid #000; }
.grid td { border-bottom: 1px dotted #999; padding: 2px 0; }
.grid tfoot td { border-bottom: none; border-top: 1px solid #000; font-weight: 700; }
.r { text-align: right; white-space: nowrap; }
.c { text-align: center; }
.t { white-space: nowrap; padding-right: 6px; }
tr.b td { font-weight: 700; }
tr.total td { font-weight: 700; font-size: ${a4 ? 13 : 11.5}px; border-top: 1px solid #000; border-bottom: 3px double #000; padding: 3px 0; }
small { font-size: ${a4 ? 9.5 : 8.5}px; }
.diff { display: flex; justify-content: space-between; align-items: center; margin: 5px 0 3px; padding: 4px 6px; border: 2px solid #000; font-weight: 700; font-size: ${a4 ? 13 : 11.5}px; }
.diff.ok { border-width: 1px; }
.diff span { letter-spacing: 1.5px; }
.note { margin-top: 6px; padding: 4px 6px; border: 1px dashed #000; font-size: ${a4 ? 10.5 : 9.5}px; }
.cols { ${a4 ? "display: grid; grid-template-columns: 1fr 1fr; gap: 0 10mm;" : ""} }
.sign { display: flex; justify-content: space-between; margin-top: ${a4 ? 36 : 26}px; font-size: ${a4 ? 10 : 9}px; }
.sign span { border-top: 1px solid #000; padding-top: 2px; width: 44%; text-align: center; }
footer { margin-top: 8px; text-align: center; font-size: ${a4 ? 9 : 8}px; color: #333; }
`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Day close ${esc(input.date)}</title><style>${css}</style></head><body><div class="wrap">
<header>
<h1>${esc(shop.name)}</h1>
${shop.address ? `<p>${esc(shop.address)}</p>` : ""}
${shop.phone || shop.gstin ? `<p>${[shop.phone ? `Ph ${esc(shop.phone)}` : "", shop.gstin ? `GSTIN ${esc(shop.gstin)}` : ""].filter(Boolean).join(" &middot; ")}</p>` : ""}
</header>
<div class="title">DAY CLOSE REPORT</div>
<table class="meta">
<tr><td>Date: <b>${esc(dateText)}</b></td><td>${input.counter ? `Counter: <b>${esc(input.counter)}</b>` : ""}</td></tr>
<tr><td>Opened: <b>${clock(day?.openedAt ?? null)}</b>${day?.openedBy ? ` ${esc(day.openedBy)}` : ""}</td><td>Closed: <b>${clock(day?.closedAt ?? null)}</b>${day?.closedBy ? ` ${esc(day.closedBy)}` : ""}</td></tr>
</table>
<div class="cols">
<div>${cash}</div>
<div>${notes}${other}</div>
</div>
${moves}
${day?.note ? `<div class="note"><b>Note:</b> ${esc(day.note)}</div>` : ""}
<div class="sign"><span>Cashier</span><span>Owner</span></div>
<footer>Printed ${esc(printed)} &middot; MediCare Pharmacy</footer>
</div></body></html>`;
}
