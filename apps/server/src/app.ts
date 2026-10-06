import Fastify, { type FastifyInstance } from "fastify";
import type { Database } from "./db/client";

/**
 * Builds the server without starting it — tests call this directly,
 * index.ts starts it on a port.
 */
export function buildApp({
  database,
}: {
  database: Database;
}): FastifyInstance {
  const app = Fastify({ logger: false });

  /** Is the server up, and can it read the database? */
  app.get("/health", async (_req, reply) => {
    let db: "ok" | "error" = "ok";
    try {
      database.raw.prepare("SELECT 1").get();
    } catch {
      db = "error";
    }
    if (db !== "ok") reply.code(503);
    return {
      ok: db === "ok",
      service: "medicare-server",
      db,
      time: new Date().toISOString(),
    };
  });

  return app;
}
