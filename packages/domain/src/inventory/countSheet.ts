/**
 * Stock count printouts (A4):
 *   "sheet"    — rack by rack, what to count, an empty box to write in
 *                (blind: the app's quantity is left out)
 *   "variance" — what was found short / excess, valued at cost, signed
 */
import { formatPaise } from "../lib/money";
import { esc } from "../printing/receipt";
import type { ReportShop } from "../cash/dayReport";
import { rackLabel, type CountSummary, type StockCount } from "./stockCount";

export type CountSheetRow = {
  rack: string;
  medicine: string;
  pack: string;
  batchNo: string;
  expiry: string;
  /** "5 strips + 4" */
  system: string;
  counted: string;
  /** "−1 strip" / "" when it matches */
  diff: string;
  diffPaise: number;
};

const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
const rs = (p: number) => `${p < 0 ? "−" : ""}₹${formatPaise(Math.abs(p))}`;

export function countSheetHtml(input: {
  shop: ReportShop;
  count: StockCount;
  rows: readonly CountSheetRow[];
  mode: "sheet" | "variance";
  blind?: boolean;
  summary?: CountSummary;
}): string {
  const { shop, count, mode } = input;
  const variance = mode === "variance";
  const rows = variance
    ? input.rows.filter((r) => r.diffPaise !== 0 || r.diff)
    : input.rows;
  const showSystem = variance || !input.blind;

  const byRack = new Map<string, CountSheetRow[]>();
  for (const r of rows) {
    const k = rackLabel(r.rack);
    byRack.set(k, [...(byRack.get(k) ?? []), r]);
  }
  const head = `<tr><th>Medicine</th><th>Batch</th><th>Exp.</th>${
    showSystem ? "<th class=r>In app</th>" : ""
  }<th class=r>${variance ? "Counted" : "Counted (write)"}</th>${
    variance ? "<th class=r>Difference</th><th class=r>Value</th>" : ""
  }</tr>`;
  const body = [...byRack]
    .map(
      ([rack, list]) =>
        `<tr class=rack><td colspan=${variance ? 7 : showSystem ? 5 : 4}>Rack ${esc(rack)} · ${list.length}</td></tr>` +
        list
          .map(
            (r) =>
              `<tr><td>${esc(r.medicine)}<small>${esc(r.pack)}</small></td><td>${esc(r.batchNo)}</td><td>${esc(r.expiry)}</td>${
                showSystem ? `<td class=r>${esc(r.system)}</td>` : ""
              }<td class="r ${variance ? "" : "box"}">${variance ? esc(r.counted) : ""}</td>${
                variance
                  ? `<td class="r ${r.diffPaise < 0 ? "neg" : "pos"}">${esc(r.diff)}</td><td class=r>${rs(r.diffPaise)}</td>`
                  : ""
              }</tr>`,
          )
          .join(""),
    )
    .join("");
  const s = input.summary;
  const totals =
    variance && s
      ? `<table class=sum><tr><td>Batches counted</td><td class=r>${s.counted} of ${s.lines}</td></tr>
<tr><td>Matched</td><td class=r>${s.matched}</td></tr>
<tr><td>Short (${s.short})</td><td class="r neg">${rs(-s.shortValuePaise)}</td></tr>
<tr><td>Excess (${s.excess})</td><td class="r pos">${rs(s.excessValuePaise)}</td></tr>
<tr class=net><td>Net difference at cost</td><td class=r>${rs(s.excessValuePaise - s.shortValuePaise)}</td></tr></table>`
      : "";

  return `<!doctype html><html><head><meta charset=utf-8><title>${esc(count.countNo)}</title><style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box}body{font:11px/1.35 system-ui,Segoe UI,Arial,sans-serif;color:#000;margin:0}
h1{font-size:15px;margin:0}.muted{color:#555}
.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}
.title{font-weight:700;font-size:12px;text-align:right}
table{width:100%;border-collapse:collapse}th,td{padding:4px 6px;border-bottom:1px solid #ccc;text-align:left;vertical-align:top}
th{font-size:10px;text-transform:uppercase;letter-spacing:.03em;border-bottom:1.5px solid #000}
.r{text-align:right}small{display:block;color:#666;font-size:9.5px}
tr.rack td{background:#eee;font-weight:700;border-bottom:1px solid #999}
td.box{width:110px;border:1px solid #999}
.neg{color:#b00}.pos{color:#060}
.sum{width:280px;margin:10px 0 0 auto}.sum .net td{font-weight:700;border-top:1.5px solid #000}
.sign{display:flex;gap:40px;margin-top:36px}.sign div{flex:1;border-top:1px solid #000;padding-top:3px;text-align:center}
tr{page-break-inside:avoid}
</style></head><body>
<div class=top><div><h1>${esc(shop.name)}</h1><div class=muted>${esc(
    [shop.address, shop.phone, shop.gstin ? `GSTIN ${shop.gstin}` : ""]
      .filter(Boolean)
      .join(" · "),
  )}</div></div>
<div class=title>${variance ? "STOCK COUNT — DIFFERENCES" : "STOCK COUNT SHEET"}<div class=muted>${esc(count.countNo)} · ${esc(
    count.racks.length ? count.racks.map(rackLabel).join(", ") : "All racks",
  )}</div><div class=muted>Started ${esc(date(count.createdAt))} by ${esc(count.createdBy)}${
    count.postedAt
      ? `</div><div class=muted>Posted ${esc(date(count.postedAt))} by ${esc(count.postedBy)}`
      : ""
  }</div></div></div>
${rows.length ? `<table><thead>${head}</thead><tbody>${body}</tbody></table>` : `<p>${variance ? "No differences — every counted batch matched." : "Nothing to count."}</p>`}
${totals}
<div class=sign><div>Counted by</div><div>Checked by</div><div>Owner</div></div>
</body></html>`;
}
