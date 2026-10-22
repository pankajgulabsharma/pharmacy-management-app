/**
 * Stock count (Inventory → Stock count). Anyone who handles stock may
 * start, count and post; the counts arrive live on every counter.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Database } from "../db/client";
import type { EventBus } from "../events";
import { parse } from "../shop/schemas";
import * as sc from "../shop/stockCount";

const qty = z.number().int().min(0).max(1_000_000).nullable();
const startInput = z
  .object({
    racks: z.array(z.string().max(40)).max(200),
    includeEmpty: z.boolean().optional(),
    note: z.string().max(120).optional(),
  })
  .strict();
const linesInput = z
  .object({
    lines: z
      .array(
        z
          .object({
            batchId: z.string().min(1).max(64),
            qtyStrip: qty,
            qtyLoose: qty,
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();

type Params = { Params: { id: string } };

export function stockCountRoutes(
  app: FastifyInstance,
  { raw }: Database,
  bus: EventBus,
) {
  app.get("/api/stock-counts", async () => ({
    counts: sc.listCounts(raw),
    racks: sc.racksInUse(raw),
  }));
  app.get<Params>("/api/stock-counts/:id", async (req) =>
    sc.getCount(raw, req.params.id),
  );
  app.post("/api/stock-counts", async (req, reply) => {
    const b = parse(startInput, req.body);
    return reply
      .code(201)
      .send(
        sc.startCount(
          raw,
          {
            racks: b.racks,
            includeEmpty: b.includeEmpty ?? false,
            note: b.note ?? "",
          },
          req.user!.name,
        ),
      );
  });
  app.put<Params>("/api/stock-counts/:id/lines", async (req) =>
    sc.saveCounts(
      raw,
      req.params.id,
      parse(linesInput, req.body).lines,
      req.user!.name,
    ),
  );
  app.post<Params>("/api/stock-counts/:id/cancel", async (req) =>
    sc.cancelCount(raw, req.params.id),
  );
  app.post<Params>("/api/stock-counts/:id/post", async (req) => {
    const out = sc.postCount(raw, req.params.id, req.user!.name);
    bus.publish(out.patch);
    return { count: out.count, lines: out.lines };
  });
}
