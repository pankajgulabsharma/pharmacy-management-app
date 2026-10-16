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
import type { Connection } from "../events";
import { isLocal } from "../auth/store";

export type CounterInfo = {
  ip: string;
  thisComputer: boolean;
  /** Who is signed in there (one per open window, same person once) */
  people: { name: string; role: string }[];
  since: string;
};

/** Open apps grouped per computer — this computer first */
export function countersFrom(
  conns: Connection[],
  ownIps: string[] = lanAddresses(),
): CounterInfo[] {
  const by = new Map<string, CounterInfo>();
  for (const c of conns) {
    const ip = c.ip.replace(/^::ffff:/, "");
    const mine = isLocal(c.ip) || ownIps.includes(ip);
    const key = mine ? "this" : ip;
    const e = by.get(key) ?? {
      ip: mine ? "" : ip,
      thisComputer: mine,
      people: [],
      since: c.since,
    };
    if (c.name && !e.people.some((p) => p.name === c.name))
      e.people.push({ name: c.name, role: c.role });
    if (c.since < e.since) e.since = c.since;
    by.set(key, e);
  }
  return [...by.values()].sort(
    (a, b) =>
      Number(b.thisComputer) - Number(a.thisComputer) ||
      a.ip.localeCompare(b.ip, "en", { numeric: true }),
  );
}

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

export function systemRoutes(
  app: FastifyInstance,
  hooks: SystemHooks,
  connections: () => Connection[] = () => [],
) {
  // Owner: which computers have MediCare open right now
  app.get("/api/system/counters", async () => ({
    counters: countersFrom(connections()),
  }));

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
