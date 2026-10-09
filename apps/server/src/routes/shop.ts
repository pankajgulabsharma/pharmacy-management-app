/**
 * Stock-and-money API: stock, purchases, bills, returns, held bills,
 * customers. Every write answers with what it changed (a ShopPatch) and the
 * same patch goes to every other open counter.
 */
import { COUNTER_MOVEMENT_TYPES } from "@medicare/domain/shop/history";
import type { FastifyInstance } from "fastify";
import type { ShopPatch } from "@medicare/domain/shop/patch";
import type { Database } from "../db/client";
import * as m from "../db/mappers";
import type { EventBus } from "../events";
import * as customers from "../shop/customers";
import * as inventory from "../shop/inventory";
import * as purchases from "../shop/purchases";
import * as sales from "../shop/sales";
import * as s from "../shop/schemas";
import { importStock } from "../shop/importStock";

type Params = { Params: { id: string } };

export function shopRoutes(
  app: FastifyInstance,
  { raw }: Database,
  bus: EventBus,
) {
  /** Run a write, tell every counter what changed, answer with result + patch */
  const write = <R extends { patch: ShopPatch }>(fn: () => R) => {
    const out = fn();
    bus.publish(out.patch);
    return out;
  };

  // Reads — everything the screens need
  // ?movements=purchase → only what counters keep (purchase receipts —
  // needed to check a purchase cancel); a batch's full history on demand
  app.get<{ Querystring: { movements?: string } }>(
    "/api/stock",
    async (req) => ({
      batches: m.loadBatches(raw),
      movements:
        req.query.movements === "purchase"
          ? m.loadMovements(
              raw,
              `type IN (${COUNTER_MOVEMENT_TYPES.map(() => "?").join(", ")})`,
              [...COUNTER_MOVEMENT_TYPES],
            )
          : m.loadMovements(raw),
    }),
  );
  // Year close: stock as it stood at a moment (e.g. 31 March, 23:59) —
  // today's stock minus every movement since then
  app.get("/api/stock/closing", async (req) => {
    const { at } = s.parse(s.closingQuery, req.query);
    const since = new Map(
      (
        raw
          .prepare(
            "SELECT batch_id AS id, SUM(qty_strip_delta) AS strip, SUM(qty_loose_delta) AS loose FROM stock_movements WHERE at >= ? GROUP BY batch_id",
          )
          .all(at) as { id: string; strip: number; loose: number }[]
      ).map((r) => [r.id, r]),
    );
    return {
      at,
      batches: m
        .loadBatches(raw)
        .map((b) => {
          const d = since.get(b.id);
          return d
            ? {
                ...b,
                qtyStrip: b.qtyStrip - d.strip,
                qtyLoose: b.qtyLoose - d.loose,
              }
            : b;
        })
        .filter((b) => b.qtyStrip > 0 || b.qtyLoose > 0),
    };
  });
  app.get<{ Params: { id: string } }>(
    "/api/stock/batches/:id/movements",
    async (req) => ({
      movements: m.loadMovements(raw, "batch_id = ?", [req.params.id]),
    }),
  );
  app.get("/api/purchases", async () => ({
    purchases: m.loadPurchases(raw),
    returns: m.loadPurchaseReturns(raw),
  }));
  /*
   * Bills. Counters load only what they need (fast, little memory):
   *   ?since=…        recent bills + every udhaar bill (khata balances)
   *   ?from=…&to=…    one period, for reports (+ bills its returns belong to)
   *   (nothing)       everything
   */
  app.get("/api/sales", async (req) => {
    const q = s.parse(s.salesQuery, req.query);
    if (q.since) {
      const recent = "created_at >= ? OR status = 'udhaar'";
      return {
        sales: m.loadSales(raw, recent, [q.since]),
        saleReturns: m.loadSaleReturns(
          raw,
          `created_at >= ? OR sale_id IN (SELECT id FROM sales WHERE ${recent})`,
          [q.since, q.since],
        ),
      };
    }
    if (q.from && q.to) {
      const inPeriod = "created_at >= ? AND created_at < ?";
      return {
        sales: m.loadSales(
          raw,
          `(${inPeriod}) OR id IN (SELECT sale_id FROM sale_returns WHERE ${inPeriod})`,
          [q.from, q.to, q.from, q.to],
        ),
        saleReturns: m.loadSaleReturns(raw, inPeriod, [q.from, q.to]),
      };
    }
    return { sales: m.loadSales(raw), saleReturns: m.loadSaleReturns(raw) };
  });
  // Older bills by number / customer (search, reprint, returns)
  app.get("/api/sales/find", async (req) => {
    const { q } = s.parse(s.findQuery, req.query);
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const found = `SELECT id FROM sales WHERE bill_no LIKE ? ESCAPE '\\' OR customer_name LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT 20`;
    return {
      sales: m.loadSales(raw, `id IN (${found})`, [like, like]),
      saleReturns: m.loadSaleReturns(raw, `sale_id IN (${found})`, [
        like,
        like,
      ]),
    };
  });
  app.get("/api/held", async () => ({ items: m.loadHeld(raw) }));
  app.get("/api/customers", async () => ({
    customers: m.loadCustomers(raw),
    payments: m.loadCustomerPayments(raw),
  }));

  // Stock
  // Excel / Marg / Tally file → medicines + opening stock (all or nothing)
  app.post("/api/medicines/import", async (req, reply) =>
    reply
      .code(201)
      .send(
        write(() => importStock(raw, s.parse(s.importInput, req.body).rows)),
      ),
  );

  app.post("/api/stock/adjust", async (req) =>
    write(() => inventory.adjustStock(raw, s.parse(s.adjustInput, req.body))),
  );

  // Purchases
  app.post("/api/purchases", async (req, reply) =>
    reply
      .code(201)
      .send(
        write(() =>
          purchases.addPurchase(raw, s.parse(s.purchaseDraft, req.body)),
        ),
      ),
  );
  app.put<Params>("/api/purchases/:id", async (req) => {
    const b = s.parse(s.purchaseEdit, req.body);
    return write(() =>
      purchases.updatePurchase(raw, req.params.id, b.draft, b.revision),
    );
  });
  app.post<Params>("/api/purchases/:id/cancel", async (req) =>
    write(() =>
      purchases.cancelPurchase(
        raw,
        req.params.id,
        s.parse(s.cancelInput, req.body).reason,
      ),
    ),
  );
  app.post<Params>("/api/purchases/:id/payments", async (req) =>
    write(() =>
      purchases.recordSupplierPayment(
        raw,
        req.params.id,
        s.parse(s.supplierPayment, req.body).amountPaise,
      ),
    ),
  );
  app.post("/api/purchase-returns", async (req, reply) =>
    reply
      .code(201)
      .send(
        write(() =>
          purchases.createPurchaseReturn(
            raw,
            s.parse(s.purchaseReturnInput, req.body),
          ),
        ),
      ),
  );

  // Billing
  app.post("/api/sales", async (req, reply) =>
    reply
      .code(201)
      .send(
        write(() =>
          sales.completeSale(
            raw,
            s.parse(s.saleInput, req.body),
            req.user!.name,
          ),
        ),
      ),
  );
  app.post("/api/sale-returns", async (req, reply) =>
    reply
      .code(201)
      .send(
        write(() =>
          sales.createSaleReturn(
            raw,
            s.parse(s.saleReturnInput, req.body),
            req.user!.name,
          ),
        ),
      ),
  );
  app.post("/api/held", async (req, reply) =>
    reply
      .code(201)
      .send(write(() => sales.holdBill(raw, s.parse(s.holdInput, req.body)))),
  );
  app.delete<Params>("/api/held/:id", async (req) =>
    write(() => sales.takeHeld(raw, req.params.id)),
  );

  // Customers & udhaar
  app.post("/api/customers", async (req, reply) =>
    reply
      .code(201)
      .send(
        write(() =>
          customers.addCustomer(raw, s.parse(s.customerInput, req.body)),
        ),
      ),
  );
  app.put<Params>("/api/customers/:id", async (req) =>
    write(() =>
      customers.updateCustomer(
        raw,
        req.params.id,
        s.parse(s.customerInput, req.body),
      ),
    ),
  );
  app.post("/api/customer-payments", async (req, reply) =>
    reply
      .code(201)
      .send(
        write(() =>
          customers.recordCustomerPayment(
            raw,
            s.parse(s.customerPayment, req.body),
          ),
        ),
      ),
  );
}
