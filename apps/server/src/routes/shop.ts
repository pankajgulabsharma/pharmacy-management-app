/**
 * Stock-and-money API: stock, purchases, bills, returns, held bills,
 * customers. Every write answers with what it changed (a ShopPatch) and the
 * same patch goes to every other open counter.
 */
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
  app.get("/api/stock", async () => ({
    batches: m.loadBatches(raw),
    movements: m.loadMovements(raw),
  }));
  app.get("/api/purchases", async () => ({
    purchases: m.loadPurchases(raw),
    returns: m.loadPurchaseReturns(raw),
  }));
  app.get("/api/sales", async () => ({
    sales: m.loadSales(raw),
    saleReturns: m.loadSaleReturns(raw),
  }));
  app.get("/api/held", async () => ({ items: m.loadHeld(raw) }));
  app.get("/api/customers", async () => ({
    customers: m.loadCustomers(raw),
    payments: m.loadCustomerPayments(raw),
  }));

  // Stock
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
        write(() => sales.completeSale(raw, s.parse(s.saleInput, req.body))),
      ),
  );
  app.post("/api/sale-returns", async (req, reply) =>
    reply
      .code(201)
      .send(
        write(() =>
          sales.createSaleReturn(raw, s.parse(s.saleReturnInput, req.body)),
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
