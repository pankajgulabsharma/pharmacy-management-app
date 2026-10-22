import type { FastifyInstance, FastifyReply } from "fastify";
import { allowedOrigins } from "./cors";
import { sessionHash } from "./auth/store";

/** What changed — every open app reloads just that part */
/** "all" = everything changed (a backup was restored) — reload it all */
export type Topic =
  | "medicines"
  | "suppliers"
  | "settings"
  | "users"
  | "license"
  | "commission"
  | "galla"
  | "stock-counts"
  | "all";

const TOPICS: readonly Topic[] = [
  "medicines",
  "suppliers",
  "settings",
  "users",
  "license",
  "commission",
  "galla",
  "stock-counts",
];

/** "/api/medicines/import" → "medicines" */
export function topicOf(url: string): Topic | null {
  const part = url.split("?")[0].split("/")[2];
  return TOPICS.includes(part as Topic) ? (part as Topic) : null;
}

/**
 * Live updates (Server-Sent Events). After any save, the server tells every
 * open app "medicines changed" — so screens update by themselves, on this
 * counter and on every other counter. No refresh needed.
 */
/** One open app (a screen on a computer) */
export type Connection = {
  ip: string;
  /** Stored form of the session (sign-in history: "signed in now") */
  session?: string;
  name: string;
  role: string;
  since: string;
};

export class EventBus {
  private clients = new Set<FastifyReply["raw"]>();
  private who = new Map<FastifyReply["raw"], Connection>();

  /** Who has MediCare open right now, and on which computer */
  connections(): Connection[] {
    return [...this.who.values()];
  }

  get size() {
    return this.clients.size;
  }

  /** Send what one stock/money operation changed to every open app */
  publish(patch: object) {
    if (Object.keys(patch).length === 0) return;
    const msg = `event: patch\ndata: ${JSON.stringify(patch)}\n\n`;
    for (const res of this.clients) res.write(msg);
  }

  emit(topic: Topic) {
    const msg = `event: change\ndata: ${JSON.stringify({ topic })}\n\n`;
    for (const res of this.clients) res.write(msg);
  }

  routes(app: FastifyInstance, origins = allowedOrigins()) {
    // After ANY successful save, tell every app what changed (by URL)
    app.addHook("onResponse", async (req, reply) => {
      if (
        req.method === "GET" ||
        req.method === "OPTIONS" ||
        reply.statusCode >= 300
      )
        return;
      const topic = topicOf(req.url);
      if (topic) this.emit(topic);
    });

    app.get("/api/events", (req, reply) => {
      reply.hijack(); // we write the stream ourselves
      const origin = req.headers.origin;
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        ...(origin && origins.has(origin)
          ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
          : {}),
      });
      // retry: how soon the app reconnects if the server restarts
      reply.raw.write("retry: 3000\n: connected\n\n");
      this.clients.add(reply.raw);
      this.who.set(reply.raw, {
        ip: req.ip,
        session: req.token ? sessionHash(req.token) : "",
        name: req.user?.name ?? "",
        role: req.user?.role ?? "",
        since: new Date().toISOString(),
      });
      // A comment every 25 s keeps the line open through idle periods
      const ping = setInterval(() => reply.raw.write(": ping\n\n"), 25_000);
      req.raw.on("close", () => {
        clearInterval(ping);
        this.clients.delete(reply.raw);
        this.who.delete(reply.raw);
      });
    });

    // Close open streams BEFORE the server stops listening — it waits for
    // every open connection, so a live stream would keep it open forever
    app.addHook("preClose", async () => {
      for (const res of this.clients) res.end();
      this.clients.clear();
      this.who.clear();
    });
  }
}
