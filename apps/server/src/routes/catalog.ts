import type { FastifyInstance } from "fastify";
import type { Database } from "../db/client";
import {
  createMedicine,
  deleteMedicine,
  getMedicine,
  listBatches,
  listMedicines,
  updateMedicine,
} from "../repos/catalog";
import { parseMedicine } from "../schemas/medicine";

/** Medicines (read + write) and stock batches (read) */
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

  app.post("/api/medicines", async (req, reply) => {
    return reply
      .code(201)
      .send(await createMedicine(db, parseMedicine(req.body)));
  });

  app.put<{ Params: { id: string } }>(
    "/api/medicines/:id",
    async (req, reply) => {
      const medicine = await updateMedicine(
        db,
        req.params.id,
        parseMedicine(req.body),
      );
      if (!medicine)
        return reply.code(404).send({ error: "Medicine not found" });
      return medicine;
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/medicines/:id",
    async (req, reply) => {
      const result = await deleteMedicine(db, req.params.id);
      if (result === "deleted") return reply.code(204).send();
      if (result === "not_found")
        return reply.code(404).send({ error: "Medicine not found" });
      return reply.code(409).send({
        error:
          result === "has_stock"
            ? "This medicine still has stock — sell, return or adjust it first"
            : "This medicine has stock or bill history — mark it Inactive instead",
      });
    },
  );

  app.get("/api/inventory/batches", async () => {
    const items = await listBatches(db);
    return { items, count: items.length };
  });
}
