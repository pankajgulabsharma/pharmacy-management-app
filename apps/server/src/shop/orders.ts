/**
 * Purchase orders on the server. Bills entered against an order tick it
 * off in the same transaction as the purchase itself (shop/purchases.ts).
 */
import type { DatabaseSync } from "node:sqlite";
import { RuleError } from "@medicare/domain/lib/errors";
import { cleanText } from "@medicare/domain/lib/sanitize";
import {
  buildOrderLines,
  canEditOrder,
  isOrderOpen,
  makeOrder,
  nextOrderNo,
  OrderError,
  ORDER_LIMITS,
  receiveOnOrder,
  type OrderInput,
  type OrderLine,
  type OrderReceipt,
  type PurchaseOrder,
} from "@medicare/domain/purchases/orders";
import type { Purchase } from "@medicare/domain/purchases/types";
import { loadMedicinesSync, loadSuppliersSync } from "../db/mappers";
import { writeTx } from "../db/sync";
import { usedNumbers } from "./docNumbers";
import { NotFoundError } from "./errors";

type Row = {
  id: string;
  order_no: string;
  supplier_id: string;
  supplier_name: string;
  status: PurchaseOrder["status"];
  date: string;
  notes: string;
  lines_json: string;
  receipts_json: string;
  created_at: string;
  created_by: string;
  sent_at: string | null;
  closed_at: string | null;
};

const parse = <T>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};
const toOrder = (r: Row): PurchaseOrder => ({
  id: r.id,
  orderNo: r.order_no,
  supplierId: r.supplier_id,
  supplierName: r.supplier_name,
  status: r.status,
  date: r.date,
  notes: r.notes,
  lines: parse<OrderLine[]>(r.lines_json, []),
  receipts: parse<OrderReceipt[]>(r.receipts_json, []),
  createdAt: r.created_at,
  createdBy: r.created_by,
  sentAt: r.sent_at,
  closedAt: r.closed_at,
});

/** Domain order errors are rule errors (400) for the app */
function rule<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof OrderError) throw new RuleError(e.message);
    throw e;
  }
}

export function listOrders(raw: DatabaseSync): PurchaseOrder[] {
  return (
    raw
      .prepare(
        "SELECT * FROM purchase_orders ORDER BY created_at DESC LIMIT 500",
      )
      .all() as Row[]
  ).map(toOrder);
}

export function getOrder(raw: DatabaseSync, id: string): PurchaseOrder {
  const r = raw
    .prepare("SELECT * FROM purchase_orders WHERE id = ?")
    .get(id) as Row | undefined;
  if (!r) throw new NotFoundError("Purchase order not found");
  return toOrder(r);
}

function save(raw: DatabaseSync, o: PurchaseOrder) {
  raw
    .prepare(
      `UPDATE purchase_orders SET supplier_id = ?, supplier_name = ?, status = ?, notes = ?,
       lines_json = ?, receipts_json = ?, sent_at = ?, closed_at = ? WHERE id = ?`,
    )
    .run(
      o.supplierId,
      o.supplierName,
      o.status,
      o.notes,
      JSON.stringify(o.lines),
      JSON.stringify(o.receipts),
      o.sentAt,
      o.closedAt,
      o.id,
    );
  return o;
}

const supplierOf = (raw: DatabaseSync, id: string) => {
  const s = loadSuppliersSync(raw).find((x) => x.id === id);
  if (!s) throw new RuleError("Choose a supplier");
  if (s.status !== "active") throw new RuleError(`${s.name} is inactive`);
  return s;
};
const medicinesOf = (raw: DatabaseSync) =>
  new Map(loadMedicinesSync(raw).map((m) => [m.id, m]));

export function createOrder(
  raw: DatabaseSync,
  input: OrderInput,
  by: string,
  now = new Date(),
) {
  return writeTx(raw, () => {
    const s = supplierOf(raw, input.supplierId);
    const no = nextOrderNo(
      usedNumbers(raw, "purchase_orders", "order_no", now).map((d) => ({
        orderNo: d.no,
        createdAt: d.at,
      })),
      now,
    );
    const o = rule(() => makeOrder(input, s, medicinesOf(raw), no, by, now));
    raw
      .prepare(
        `INSERT INTO purchase_orders (id, order_no, supplier_id, supplier_name, status, date, notes,
         lines_json, receipts_json, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)`,
      )
      .run(
        o.id,
        o.orderNo,
        o.supplierId,
        o.supplierName,
        o.status,
        o.date,
        o.notes,
        JSON.stringify(o.lines),
        o.createdAt,
        o.createdBy,
      );
    return o;
  });
}

export function updateOrder(raw: DatabaseSync, id: string, input: OrderInput) {
  return writeTx(raw, () => {
    const o = getOrder(raw, id);
    if (!canEditOrder(o))
      throw new RuleError(
        "Goods have come against this order — it can't be changed now",
      );
    const s = supplierOf(raw, input.supplierId);
    return save(raw, {
      ...o,
      supplierId: s.id,
      supplierName: s.name,
      notes: cleanText(input.notes, ORDER_LIMITS.notesMax),
      lines: rule(() =>
        buildOrderLines(input.lines, medicinesOf(raw), o.lines),
      ),
    });
  });
}

export function markSent(raw: DatabaseSync, id: string, now = new Date()) {
  return writeTx(raw, () => {
    const o = getOrder(raw, id);
    if (o.status !== "open" && o.status !== "sent") return o;
    return save(raw, {
      ...o,
      status: "sent",
      sentAt: o.sentAt ?? now.toISOString(),
    });
  });
}

/** Stop waiting: what didn't come stays short */
export function closeOrder(raw: DatabaseSync, id: string, now = new Date()) {
  return writeTx(raw, () => {
    const o = getOrder(raw, id);
    if (!isOrderOpen(o)) throw new RuleError(`Order ${o.orderNo} is not open`);
    if (!o.receipts.length)
      throw new RuleError("Nothing has come yet — cancel the order instead");
    return save(raw, { ...o, status: "closed", closedAt: now.toISOString() });
  });
}

export function cancelOrder(raw: DatabaseSync, id: string, now = new Date()) {
  return writeTx(raw, () => {
    const o = getOrder(raw, id);
    if (!isOrderOpen(o)) throw new RuleError(`Order ${o.orderNo} is not open`);
    if (o.receipts.length)
      throw new RuleError("Goods have come — close the order instead");
    return save(raw, {
      ...o,
      status: "cancelled",
      closedAt: now.toISOString(),
    });
  });
}

/** Inside the purchase's transaction: tick off what came */
export function receiveAgainstOrder(
  raw: DatabaseSync,
  orderId: string,
  purchase: Purchase,
  now = new Date(),
) {
  const o = getOrder(raw, orderId);
  return save(
    raw,
    rule(() => receiveOnOrder(o, purchase, now)),
  );
}
