import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Library } from "../library/library";
import { parse } from "../shop/schemas";

const searchQuery = z.object({
  q: z.string().max(80),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/** Medicine Library search (read-only, any signed-in user) */
export function libraryRoutes(app: FastifyInstance, library?: Library) {
  app.get("/api/library/search", async (req) => {
    const { q, limit } = parse(searchQuery, req.query);
    return {
      status: library?.status() ?? "missing",
      items: library?.search(q, limit) ?? [],
    };
  });
}
