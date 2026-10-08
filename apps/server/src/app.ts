import Fastify, { type FastifyInstance } from "fastify";
import { RuleError } from "@medicare/domain/lib/errors";
import { DEFAULT_BACKUP_DIR, type Database } from "./db/client";
import { cors } from "./cors";
import { EventBus } from "./events";
import { catalogRoutes } from "./routes/catalog";
import { supplierRoutes } from "./routes/suppliers";
import { shopRoutes } from "./routes/shop";
import { authRoutes } from "./routes/auth";
import { settingsRoutes } from "./routes/settings";
import { backupRoutes } from "./routes/backups";
import { serveApp } from "./static";
import { systemRoutes, type SystemHooks } from "./routes/system";
import { licenseRoutes } from "./routes/license";
import type { LicenseOptions } from "./license/state";
import { LICENSE_PUBLIC_KEY } from "./license/public-key";
import { machineCode } from "./license/machine";
import { AuthError, authGuard } from "./auth/guard";
import { security } from "./security";
import { NotFoundError, isRuleError } from "./shop/errors";
import { InputError } from "./schemas/medicine";

/**
 * Installed app sets LICENSE_ENFORCE=1; development and tests run without.
 * `npm run dev:server:license` (--license) tries the trial in development.
 */
const defaultLicense = (): LicenseOptions => ({
  enforce:
    process.env.LICENSE_ENFORCE === "1" || process.argv.includes("--license"),
  publicKey: LICENSE_PUBLIC_KEY,
  machine: machineCode(),
});

/**
 * Builds the server without starting it — tests call this directly,
 * index.ts starts it on a port.
 */
export function buildApp({
  database,
  bus = new EventBus(),
  backupDir = DEFAULT_BACKUP_DIR,
  appDir,
  system = { lanEnabled: () => process.env.HOST === "0.0.0.0" },
  license = defaultLicense(),
}: {
  database: Database;
  bus?: EventBus;
  /** Where backups are kept (default: next to the database) */
  backupDir?: string;
  /** Built app screens to serve (installed app / shop network) */
  appDir?: string;
  /** Shop-network sharing (the installed app can switch it) */
  system?: SystemHooks;
  /** Licence checking (on in the installed app) */
  license?: LicenseOptions;
}): FastifyInstance {
  const app = Fastify({ logger: false });
  cors(app);
  security(app); // safety headers + per-computer request limit

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

  authGuard(app, database.raw, license); // sign-in, role, licence before every /api call
  bus.routes(app); // GET /api/events + "something changed" after every save
  authRoutes(app, database, license);
  licenseRoutes(app, database, license);
  settingsRoutes(app, database);
  backupRoutes(app, database, bus, backupDir);
  systemRoutes(app, system);
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
  if (appDir) serveApp(app, appDir);
  else
    app.setNotFoundHandler((_req, reply) =>
      reply.code(404).send({ error: "Not found" }),
    );

  return app;
}
