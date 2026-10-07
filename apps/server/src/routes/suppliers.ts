import type { FastifyInstance } from "fastify";
import type { Database } from "../db/client";
import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from "../repos/suppliers";
import { parseSupplier } from "../schemas/supplier";

export function supplierRoutes(app: FastifyInstance, { db }: Database) {
  app.get("/api/suppliers", async () => {
    const items = await listSuppliers(db);
    return { items, count: items.length };
  });

  app.get<{ Params: { id: string } }>(
    "/api/suppliers/:id",
    async (req, reply) => {
      const s = await getSupplier(db, req.params.id);
      return s ?? reply.code(404).send({ error: "Supplier not found" });
    },
  );

  app.post("/api/suppliers", async (req, reply) => {
    const s = await createSupplier(db, parseSupplier(req.body));
    return reply.code(201).send(s);
  });

  app.put<{ Params: { id: string } }>(
    "/api/suppliers/:id",
    async (req, reply) => {
      const s = await updateSupplier(
        db,
        req.params.id,
        parseSupplier(req.body),
      );
      if (!s) return reply.code(404).send({ error: "Supplier not found" });
      return s;
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/suppliers/:id",
    async (req, reply) => {
      const r = await deleteSupplier(db, req.params.id);
      if (r === "not_found")
        return reply.code(404).send({ error: "Supplier not found" });
      if (r === "has_invoices") {
        return reply
          .code(409)
          .send({
            error: "This supplier has invoices — set it Inactive instead",
          });
      }
      return reply.code(204).send();
    },
  );
}
