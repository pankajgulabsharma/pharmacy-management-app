import Fastify, { type FastifyInstance } from "fastify";

/**
 * Builds the server without starting it — tests call this directly,
 * index.ts starts it on a port.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  /** Is the server up? The desktop app will check this before syncing. */
  app.get("/health", async () => ({ ok: true, service: "medicare-server", time: new Date().toISOString() }));

  return app;
}
