/**
 * Purchase orders — kept light, the way a chemist really orders:
 *
 *   make   → from "What to order" (sales speed) or by hand, per supplier
 *   send   → WhatsApp / print; the order is marked "sent"
 *   receive→ the invoice that comes is entered from the order (supplier and
 *            medicines filled in, quantities = what is still to come);
 *            batch, expiry and rate are typed from the bill as usual
 *   short  → whatever didn't come shows as short; close the order to stop
 *            waiting, or receive the rest on the next bill
 */
import type { Medicine } from "../medicines/types";
import { formatPackLabel } from "../medicines/types";
import { nextDocNo } from "../lib/docNo";
import { newId } from "../lib/id";
import { formatPaise, paiseToInput, type Paise } from "../lib/money";
import { cleanText } from "../lib/sanitize";
import { esc } from "../printing/receipt";
import {
  WA_LINE,
  waJoin,
  waNumber,
  waShopFooter,
  waShopHeader,
  type WhatsAppShop,
} from "../printing/whatsapp";
import { createEmptyDraft, createLineFromMedicine } from "./draft";
import type { GstRate, Purchase, PurchaseDraft } from "./types";

export type OrderStatus =
  "open" | "sent" | "partial" | "received" | "closed" | "cancelled";

export const ORDER_STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    tone: "info" | "caution" | "success" | "neutral" | "warning";
  }
> = {
  open: { label: "Not sent", tone: "neutral" },
  sent: { label: "Sent", tone: "info" },
  partial: { label: "Part received", tone: "caution" },
  received: { label: "Received", tone: "success" },
  closed: { label: "Closed short", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export type OrderLine = {
  id: string;
  medicineId: string;
  medicineName: string;
  brand: string;
  unit: string;
  unitsPerStrip: number;
  /** Packs ordered */
  qty: number;
  /** Packs received so far (billed + free) */
  receivedQty: number;
  /** Rate expected (excl. GST, per pack) — from the last bill; 0 = unknown */
  ratePaise: Paise;
  gstPercent: GstRate;
};

export type OrderReceipt = {
  purchaseId: string;
  invoiceNo: string;
  at: string;
};

export type PurchaseOrder = {
  id: string;
  /** "PO/26-27/0004" */
  orderNo: string;
  supplierId: string;
  supplierName: string;
  status: OrderStatus;
  /** "YYYY-MM-DD" */
  date: string;
  notes: string;
  lines: OrderLine[];
  receipts: OrderReceipt[];
  createdAt: string;
  createdBy: string;
  sentAt: string | null;
  closedAt: string | null;
};

/** What the order form sends */
export type OrderInput = {
  supplierId: string;
  notes: string;
  lines: { medicineId: string; qty: number; ratePaise: number }[];
};

export const ORDER_LIMITS = { maxLines: 150, notesMax: 300, qtyMax: 100_000 };

export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}

/** "PO/26-27/0001", per financial year */
export function nextOrderNo(
  orders: readonly Pick<PurchaseOrder, "orderNo" | "createdAt">[],
  now = new Date(),
) {
  return nextDocNo(
    orders.map((o) => ({ no: o.orderNo, at: o.createdAt })),
    "PO",
    now,
  );
}

/** Last bill's rate and GST per medicine (to price an order) */
export function lastRates(purchases: readonly Purchase[]) {
  const out = new Map<
    string,
    { ratePaise: Paise; gstPercent: GstRate; at: string; supplierId: string }
  >();
  for (const p of purchases) {
    if (p.status !== "active") continue;
    for (const l of p.lines) {
      const prev = out.get(l.medicineId);
      if (!prev || p.invoiceDate > prev.at)
        out.set(l.medicineId, {
          ratePaise: l.ratePaise,
          gstPercent: l.gstPercent,
          at: p.invoiceDate,
          supplierId: p.supplierId,
        });
    }
  }
  return out;
}

/** Order lines from the form, checked against the medicine master */
export function buildOrderLines(
  input: OrderInput["lines"],
  medicines: ReadonlyMap<string, Medicine>,
  previous: readonly OrderLine[] = [],
): OrderLine[] {
  if (!input.length) throw new OrderError("Add at least one medicine");
  if (input.length > ORDER_LIMITS.maxLines)
    throw new OrderError(`At most ${ORDER_LIMITS.maxLines} medicines`);
  const seen = new Set<string>();
  return input.map((l) => {
    const m = medicines.get(l.medicineId);
    if (!m) throw new OrderError("Unknown medicine on the order");
    if (seen.has(m.id)) throw new OrderError(`${m.name} is listed twice`);
    seen.add(m.id);
    if (!Number.isInteger(l.qty) || l.qty <= 0 || l.qty > ORDER_LIMITS.qtyMax)
      throw new OrderError(`${m.name}: enter a quantity`);
    const was = previous.find((p) => p.medicineId === m.id);
    return {
      id: was?.id ?? newId("pol"),
      medicineId: m.id,
      medicineName: m.name,
      brand: m.brand,
      unit: m.unit,
      unitsPerStrip: m.unitsPerStrip,
      qty: l.qty,
      receivedQty: was?.receivedQty ?? 0,
      ratePaise: Math.max(0, Math.round(l.ratePaise) || 0),
      gstPercent: m.gstPercent,
    };
  });
}

export function makeOrder(
  input: OrderInput,
  supplier: { id: string; name: string },
  medicines: ReadonlyMap<string, Medicine>,
  orderNo: string,
  by: string,
  now = new Date(),
): PurchaseOrder {
  const iso = now.toISOString();
  return {
    id: newId("po"),
    orderNo,
    supplierId: supplier.id,
    supplierName: supplier.name,
    status: "open",
    date: iso.slice(0, 10),
    notes: cleanText(input.notes, ORDER_LIMITS.notesMax),
    lines: buildOrderLines(input.lines, medicines),
    receipts: [],
    createdAt: iso,
    createdBy: by,
    sentAt: null,
    closedAt: null,
  };
}

/** Packs still to come on a line */
export const pendingQty = (l: OrderLine) => Math.max(0, l.qty - l.receivedQty);

/** Still waiting for goods */
export const isOrderOpen = (o: PurchaseOrder) =>
  o.status === "open" || o.status === "sent" || o.status === "partial";

/** Changing the medicines is fine until goods arrive */
export const canEditOrder = (o: PurchaseOrder) =>
  (o.status === "open" || o.status === "sent") && o.receipts.length === 0;

export function orderValuePaise(lines: readonly OrderLine[]) {
  return lines.reduce(
    (a, l) =>
      a + Math.round((l.qty * l.ratePaise * (100 + l.gstPercent)) / 100),
    0,
  );
}

/** Lines that came short (or not at all) */
export function shortLines(o: PurchaseOrder) {
  return o.lines.filter((l) => pendingQty(l) > 0);
}

/**
 * A bill entered against the order: what came (billed + free packs per
 * medicine) is ticked off; status follows.
 */
export function receiveOnOrder(
  o: PurchaseOrder,
  p: Pick<Purchase, "id" | "invoiceNo" | "lines" | "supplierId">,
  now = new Date(),
): PurchaseOrder {
  if (!isOrderOpen(o))
    throw new OrderError(
      `Order ${o.orderNo} is already ${ORDER_STATUS_META[o.status].label.toLowerCase()}`,
    );
  if (p.supplierId !== o.supplierId)
    throw new OrderError(`Order ${o.orderNo} is for ${o.supplierName}`);
  const came = new Map<string, number>();
  for (const l of p.lines)
    came.set(l.medicineId, (came.get(l.medicineId) ?? 0) + l.qty + l.freeQty);
  const lines = o.lines.map((l) => ({
    ...l,
    receivedQty: l.receivedQty + (came.get(l.medicineId) ?? 0),
  }));
  const done = lines.every((l) => pendingQty(l) === 0);
  return {
    ...o,
    lines,
    receipts: [
      ...o.receipts,
      { purchaseId: p.id, invoiceNo: p.invoiceNo, at: now.toISOString() },
    ],
    status: done ? "received" : "partial",
    closedAt: done ? now.toISOString() : o.closedAt,
  };
}

/** The purchase form, filled from the order: what is still to come */
export function orderToDraft(
  o: PurchaseOrder,
  medicines: ReadonlyMap<string, Medicine>,
  today = new Date(),
): PurchaseDraft {
  const draft = createEmptyDraft(today);
  draft.supplierId = o.supplierId;
  draft.orderId = o.id;
  draft.notes = `Against ${o.orderNo}`;
  for (const l of o.lines) {
    const m = medicines.get(l.medicineId);
    const left = pendingQty(l);
    if (!m || left <= 0) continue;
    const line = createLineFromMedicine(m);
    line.qty = String(left);
    if (l.ratePaise > 0) line.rate = paiseToInput(l.ratePaise);
    draft.lines.push(line);
  }
  return draft;
}

const day = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/** WhatsApp message for the distributor */
export function orderMessage(o: PurchaseOrder, shop: WhatsAppShop): string {
  return waJoin([
    `🛒 *PURCHASE ORDER ${o.orderNo}*`,
    ...waShopHeader(shop),
    `📅 ${day(o.date)}`,
    `To: *${o.supplierName}*`,
    WA_LINE,
    ...o.lines.map(
      (l, i) =>
        `${waNumber(i)} *${l.medicineName}* — ${pendingQty(l) || l.qty} ${l.unit}`,
    ),
    WA_LINE,
    `📦 *Items: ${o.lines.length}*`,
    ...(o.notes ? [`📝 ${o.notes}`] : []),
    "🙏 Please confirm availability, rate & delivery time.",
    ...waShopFooter(shop),
  ]);
}

/** A4 order sheet */
export function orderHtml(
  o: PurchaseOrder,
  shop: WhatsAppShop & { gstin?: string; drugLicense?: string },
  supplier: { gstin?: string; address?: string; phone?: string },
): string {
  const value = orderValuePaise(o.lines);
  const rows = o.lines
    .map(
      (l, i) =>
        `<tr><td>${i + 1}</td><td>${esc(l.medicineName)}<small>${esc(
          [l.brand, formatPackLabel(l.unit as never, l.unitsPerStrip)]
            .filter(Boolean)
            .join(" · "),
        )}</small></td><td class=r><b>${l.qty}</b> ${esc(l.unit)}</td><td class=r>${
          l.ratePaise ? formatPaise(l.ratePaise) : "—"
        }</td><td class=r>${l.gstPercent}%</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset=utf-8><title>${esc(o.orderNo)}</title><style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box}body{font:11px/1.4 system-ui,Segoe UI,Arial,sans-serif;color:#000;margin:0}
.head{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:6px}
h1{font-size:16px;margin:0}.muted{color:#555}.title{text-align:right;font-weight:700;font-size:13px}
.to{border:1px solid #999;padding:6px 8px;margin:8px 0;width:55%}
.lbl{font-size:9.5px;text-transform:uppercase;color:#555}
table{width:100%;border-collapse:collapse}th,td{padding:4px 6px;border-bottom:1px solid #ccc;text-align:left;vertical-align:top}
th{font-size:10px;text-transform:uppercase;border-bottom:1.5px solid #000;border-top:1.5px solid #000}
.r{text-align:right}small{display:block;color:#666;font-size:9.5px}
.sum{margin-top:8px;text-align:right}.note{margin-top:8px;border:1px dashed #999;padding:6px 8px}
.sign{margin-top:44px;text-align:right}.sign span{display:inline-block;width:220px;border-top:1px solid #000;padding-top:3px;text-align:center}
</style></head><body>
<div class=head><div><h1>${esc(shop.name)}</h1><div class=muted>${esc(
    [
      shop.address,
      shop.phone ? `Ph. ${shop.phone}` : "",
      shop.gstin ? `GSTIN ${shop.gstin}` : "",
      shop.drugLicense ? `D.L. ${shop.drugLicense}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  )}</div></div><div class=title>PURCHASE ORDER<div class=muted>${esc(o.orderNo)} · ${esc(day(o.date))}</div></div></div>
<div class=to><div class=lbl>To</div><b>${esc(o.supplierName)}</b>${
    supplier.address ? `<div>${esc(supplier.address)}</div>` : ""
  }${supplier.phone ? `<div>Ph. ${esc(supplier.phone)}</div>` : ""}${
    supplier.gstin ? `<div>GSTIN ${esc(supplier.gstin)}</div>` : ""
  }</div>
<table><thead><tr><th>#</th><th>Item</th><th class=r>Qty</th><th class=r>Last rate</th><th class=r>GST</th></tr></thead><tbody>${rows}</tbody></table>
<div class=sum>${o.lines.length} items${value ? ` · approx. ₹${formatPaise(value)} incl. GST` : ""}</div>
${o.notes ? `<div class=note><b>Note:</b> ${esc(o.notes)}</div>` : ""}
<p class=muted>Please supply with batch no. and expiry on the bill; short-dated stock is not accepted.</p>
<div class=sign><span>For ${esc(shop.name)}</span></div>
</body></html>`;
}
