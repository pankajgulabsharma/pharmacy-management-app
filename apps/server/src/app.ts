import Fastify, { type FastifyInstance } from "fastify";
import { RuleError } from "@medicare/domain/lib/errors";
import type { Database } from "./db/client";
import { cors } from "./cors";
import { EventBus } from "./events";
import { catalogRoutes } from "./routes/catalog";
import { supplierRoutes } from "./routes/suppliers";
import { shopRoutes } from "./routes/shop";
import { authRoutes } from "./routes/auth";
import { settingsRoutes } from "./routes/settings";
import { AuthError, authGuard } from "./auth/guard";
import { NotFoundError, isRuleError } from "./shop/errors";
import { InputError } from "./schemas/medicine";

/**
 * Builds the server without starting it — tests call this directly,
 * index.ts starts it on a port.
 */
export function buildApp({
  database,
  bus = new EventBus(),
}: {
  database: Database;
  bus?: EventBus;
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

  authGuard(app, database.raw); // sign-in + role check before every /api call
  bus.routes(app); // GET /api/events + "something changed" after every save
  authRoutes(app, database);
  settingsRoutes(app, database);
  catalogRoutes(app, database);
  supplierRoutes(app, database);
  shopRoutes(app, database, bus);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AuthError)
      return reply.code(err.statusCode).send({ error: err.message });
    // Bad input / a broken shop rule → 400 with a plain message
    if (err instanceof NotFoundError)
      return reply.code(404).send({ error: err.message });
    if (
      err instanceof InputError ||
      err instanceof RuleError ||
      isRuleError(err)
    ) {
      return reply.code(400).send({ error: err.message });
    }
    // Two counters saving the same thing at once — the database index caught it
    if (/UNIQUE constraint failed/.test(String((err as Error).message))) {
      return reply.code(409).send({ error: "This already exists" });
    }
    // Anything unexpected → a plain message, never internal details
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) console.error(err);
    return reply.code(status).send({
      error: status < 500 ? (err as Error).message : "Something went wrong",
    });
  });
  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send({ error: "Not found" }),
  );

  return app;
}
