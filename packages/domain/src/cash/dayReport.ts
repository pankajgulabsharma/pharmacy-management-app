/**
 * Galla day report — a till slip for the thermal printer (80 mm) or A4:
 * the day's cash in and out, what was counted, short / excess, and what
 * was left for tomorrow. Signed by the cashier and the owner.
 */
import { formatPaise } from "../lib/money";
import {
  COINS_KEY,
  differenceOf,
  NOTES,
  type CashDay,
  type CashEntry,
  type GallaSummary,
} from "./galla";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const rs = (p: number) => `${p < 0 ? "-" : ""}Rs ${formatPaise(Math.abs(p))}`;

export function dayReportHtml(input: {
  shopName: string;
  date: string;
  counter: string;
  day: CashDay | null;
  summary: GallaSummary;
  entries: readonly CashEntry[];
  printedAt?: Date;
}): string {
  const { day, summary: s } = input;
  const row = (label: string, value: string, strong = false) =>
    `<tr${strong ? ' class="b"' : ""}><td>${esc(label)}</td><td class="r">${esc(value)}</td></tr>`;
  const diff = day ? differenceOf(day) : null;
  const notes = day
    ? NOTES.filter((n) => day.denominations[String(n)])
        .map((n) =>
          row(
            `Rs ${n} x ${day.denominations[String(n)]}`,
            rs(n * 100 * day.denominations[String(n)]),
          ),
        )
        .join("") +
      (day.denominations[COINS_KEY]
        ? row("Coins", rs(day.denominations[COINS_KEY]))
        : "")
    : "";
  const moves = input.entries
    .map((e) =>
      row(
        `${new Date(e.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} ${e.category}${e.note ? ` (${e.note})` : ""}`,
        `${e.kind === "in" ? "+" : "-"}${rs(e.amountPaise)}`,
      ),
    )
    .join("");
  const printed = (input.printedAt ?? new Date()).toLocaleString("en-IN");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Galla ${esc(input.date)}</title><style>
* { box-sizing: border-box; }
body { margin: 0; padding: 3mm; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; }
h1 { font-size: 13px; margin: 0; text-align: center; }
.c { text-align: center; } .r { text-align: right; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; margin-top: 4px; }
td { padding: 1px 0; vertical-align: top; }
tr.b td { font-weight: 700; border-top: 1px dashed #000; padding-top: 3px; }
h2 { font-size: 11px; margin: 8px 0 0; border-bottom: 1px solid #000; }
.sign { display: flex; justify-content: space-between; margin-top: 22px; }
.sign span { border-top: 1px solid #000; padding-top: 2px; width: 45%; text-align: center; }
</style></head><body>
<h1>${esc(input.shopName)}</h1>
<p class="c">GALLA / DAY CLOSE<br>${esc(input.date)}${input.counter ? ` &middot; ${esc(input.counter)}` : ""}</p>
<h2>Cash</h2><table>
${row("Opening cash", rs(s.openingPaise))}
${row(`+ Cash bills (${s.cashBills})`, rs(s.cashSalesPaise))}
${s.udhaarCollectedPaise ? row("+ Udhaar received", rs(s.udhaarCollectedPaise)) : ""}
${s.otherInPaise ? row("+ Other cash in", rs(s.otherInPaise)) : ""}
${s.refundsPaise ? row("- Cash refunds", rs(s.refundsPaise)) : ""}
${s.supplierPaidPaise ? row("- Suppliers paid", rs(s.supplierPaidPaise)) : ""}
${s.otherOutPaise ? row("- Expenses & other", rs(s.otherOutPaise)) : ""}
${row("Should be in galla", rs(day?.expectedPaise ?? s.expectedPaise), true)}
${day?.countedPaise != null ? row("Counted", rs(day.countedPaise)) : ""}
${diff !== null ? row(diff === 0 ? "Difference" : diff < 0 ? "SHORT" : "EXCESS", rs(diff), true) : ""}
${day?.keptPaise != null ? row("Left for tomorrow", rs(day.keptPaise)) : ""}
${day?.keptPaise != null && day.countedPaise != null ? row("Taken out", rs(day.countedPaise - day.keptPaise)) : ""}
</table>
${notes ? `<h2>Notes counted</h2><table>${notes}</table>` : ""}
<h2>Not in galla</h2><table>
${row(`Sales (${s.bills} bills)`, rs(s.salesPaise))}
${s.upiPaise ? row("UPI", rs(s.upiPaise)) : ""}
${s.cardPaise ? row("Card", rs(s.cardPaise)) : ""}
${s.walletPaise ? row("Wallet", rs(s.walletPaise)) : ""}
${s.udhaarGivenPaise ? row("Udhaar given", rs(s.udhaarGivenPaise)) : ""}
</table>
${moves ? `<h2>Cash in / out</h2><table>${moves}</table>` : ""}
${day?.note ? `<p>Note: ${esc(day.note)}</p>` : ""}
<p>${day?.openedBy ? `Opened by ${esc(day.openedBy)}` : ""}${day?.closedBy ? ` &middot; Closed by ${esc(day.closedBy)}` : ""}<br>Printed ${esc(printed)}</p>
<div class="sign"><span>Cashier</span><span>Owner</span></div>
</body></html>`;
}
