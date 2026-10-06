import type { FastifyInstance } from "fastify";

/**
 * Lets the desktop app (a different port) call this server — and ONLY the
 * desktop app: other websites open in the same browser get no permission.
 * CORS_ORIGINS = comma-separated list; the default is the dev app.
 */
const DEFAULT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export function allowedOrigins(env = process.env.CORS_ORIGINS): Set<string> {
  const list = env
    ? env
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : DEFAULT_ORIGINS;
  return new Set(list);
}

export function cors(app: FastifyInstance, origins = allowedOrigins()) {
  app.addHook("onRequest", async (req, reply) => {
    const origin = req.headers.origin;
    if (!origin || !origins.has(origin)) return; // not our app → no CORS headers
    reply.header("Access-Control-Allow-Origin", origin);
    reply.header("Vary", "Origin");
    if (req.method === "OPTIONS") {
      // Browser's "may I?" check before a real request
      reply
        .header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE")
        .header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        .header("Access-Control-Max-Age", "600")
        .code(204)
        .send();
    }
  });
}
