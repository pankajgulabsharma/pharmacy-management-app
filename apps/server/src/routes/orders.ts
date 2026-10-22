/**
 * Purchase orders (Purchases → Orders). Same rights as purchases; every
 * change reaches the other counters through the "purchase-orders" topic.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ORDER_LIMITS } from "@medicare/domain/purchases/orders";
import type { Database } from "../db/client";
import * as o from "../shop/orders";
import { parse } from "../shop/schemas";

const id = z.string().min(1).max(64);
const orderInput = z
  .object({
    supplierId: id,
    notes: z.string().max(ORDER_LIMITS.notesMax * 2),
    lines: z
      .array(
        z
          .object({
            medicineId: id,
            qty: z.number().int().positive().max(ORDER_LIMITS.qtyMax),
            ratePaise: z.number().int().min(0).max(100_000_000),
          })
          .strict(),
      )
      .min(1)
      .max(ORDER_LIMITS.maxLines),
  })
  .strict();

type Params = { Params: { id: string } };

export function orderRoutes(app: FastifyInstance, { raw }: Database) {
  app.get("/api/purchase-orders", async () => ({ orders: o.listOrders(raw) }));
  app.post("/api/purchase-orders", async (req, reply) =>
    reply
      .code(201)
      .send(o.createOrder(raw, parse(orderInput, req.body), req.user!.name)),
  );
  app.put<Params>("/api/purchase-orders/:id", async (req) =>
    o.updateOrder(raw, req.params.id, parse(orderInput, req.body)),
  );
  app.post<Params>("/api/purchase-orders/:id/sent", async (req) =>
    o.markSent(raw, req.params.id),
  );
  app.post<Params>("/api/purchase-orders/:id/close", async (req) =>
    o.closeOrder(raw, req.params.id),
  );
  app.post<Params>("/api/purchase-orders/:id/cancel", async (req) =>
    o.cancelOrder(raw, req.params.id),
  );
}
