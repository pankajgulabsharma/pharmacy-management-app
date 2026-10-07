/**
 * "This computer": is the shop network sharing on, and which address do
 * the other counters type? The installed app can switch sharing on/off
 * (it restarts the server on the network); `npm run dev:server` uses HOST.
 */
import { networkInterfaces } from "node:os";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { RuleError } from "@medicare/domain/lib/errors";
import { parse } from "../shop/schemas";

export type SystemHooks = {
  /** Listening on the shop network (0.0.0.0) right now? */
  lanEnabled: () => boolean;
  /** Switch it (installed app only) — called after the answer is sent */
  setLan?: (enabled: boolean) => Promise<void>;
};

/** This computer's addresses on the shop network (Wi-Fi / cable) */
export function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === "IPv4" && !n.internal)
    .map((n) => n!.address);
}

export function systemRoutes(app: FastifyInstance, hooks: SystemHooks) {
  app.get("/api/system", async () => {
    const addr = app.server.address();
    const port = typeof addr === "object" && addr ? addr.port : 4000;
    return {
      lan: { enabled: hooks.lanEnabled(), canChange: !!hooks.setLan },
      port,
      addresses: lanAddresses().map((ip) => `http://${ip}:${port}`),
    };
  });

  app.post("/api/system/lan", async (req, reply) => {
    const { enabled } = parse(
      z.object({ enabled: z.boolean() }).strict(),
      req.body,
    );
    const setLan = hooks.setLan;
    if (!setLan)
      throw new RuleError(
        "Start the server with HOST=0.0.0.0 to share it on the shop network",
      );
    // Answer first — switching restarts the server (open apps reconnect by themselves)
    reply.raw.once("finish", () => {
      void setLan(enabled).catch((err) =>
        console.error("Could not switch network sharing:", err),
      );
    });
    return { enabled };
  });
}
