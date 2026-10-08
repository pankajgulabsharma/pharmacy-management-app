/**
 * Basic protections for every answer the server gives:
 *  • browser safety headers — the app can't be framed by another site,
 *    files can't be mis-read as scripts, and the screens may only load
 *    code from this server (Content-Security-Policy);
 *  • a per-computer request limit — one computer (or a script) flooding
 *    the server can't slow down the other counters.
 */
import type { FastifyInstance } from "fastify";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Requests per computer: a burst of 300, then 20 per second */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  constructor(
    readonly burst = 300,
    readonly perSecond = 20,
  ) {}

  take(key: string, now = Date.now()): boolean {
    const b = this.buckets.get(key) ?? { tokens: this.burst, at: now };
    b.tokens = Math.min(
      this.burst,
      b.tokens + ((now - b.at) / 1000) * this.perSecond,
    );
    b.at = now;
    const ok = b.tokens >= 1;
    if (ok) b.tokens -= 1;
    this.buckets.set(key, b);
    if (this.buckets.size > 5000) this.buckets.clear(); // never grows without limit
    return ok;
  }
}

export function security(app: FastifyInstance, limiter = new RateLimiter()) {
  app.addHook("onRequest", async (req, reply) => {
    if (req.url.startsWith("/api/") && !limiter.take(req.ip))
      return reply
        .code(429)
        .send({
          error: "Too many requests from this computer — wait a moment",
        });
  });
  app.addHook("onSend", async (_req, reply, payload) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("X-Frame-Options", "DENY")
      .header("Referrer-Policy", "no-referrer")
      .header("Cross-Origin-Opener-Policy", "same-origin")
      .header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    const type = String(reply.getHeader("Content-Type") ?? "");
    if (type.startsWith("text/html"))
      reply.header("Content-Security-Policy", CSP);
    return payload;
  });
}
