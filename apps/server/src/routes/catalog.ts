import type { FastifyInstance } from "fastify";
import type { Database } from "../db/client";
import { getMedicine, listBatches, listMedicines } from "../repos/catalog";

/** Read-only catalogue: medicines and stock batches */
export function catalogRoutes(app: FastifyInstance, { db }: Database) {
  app.get("/api/medicines", async () => {
    const items = await listMedicines(db);
    return { items, count: items.length };
  });

  app.get<{ Params: { id: string } }>(
    "/api/medicines/:id",
    async (req, reply) => {
      const medicine = await getMedicine(db, req.params.id);
      if (!medicine)
        return reply.code(404).send({ error: "Medicine not found" });
      return medicine;
    },
  );

  app.get("/api/inventory/batches", async () => {
    const items = await listBatches(db);
    return { items, count: items.length };
  });
}
