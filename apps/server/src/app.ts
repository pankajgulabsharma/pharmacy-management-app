import Fastify, { type FastifyInstance } from "fastify";
import type { Database } from "./db/client";
import { catalogRoutes } from "./routes/catalog";
import { InputError } from "./schemas/medicine";
import { cors } from "./cors";

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
  cors(app);

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

  catalogRoutes(app, database);

  // Any unexpected failure → a plain message, never internal details
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof InputError)
      return reply.code(400).send({ error: err.message });
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) console.error(err);
    reply.code(status).send({
      error: status < 500 ? (err as Error).message : "Something went wrong",
    });
  });
  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send({ error: "Not found" }),
  );

  return app;
}
