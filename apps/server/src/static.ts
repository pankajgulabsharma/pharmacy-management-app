/**
 * Serves the app's screens (the built desktop UI) from the server itself.
 * Then any computer on the shop network can simply open
 * http://<main-pc>:4000 — same address for the screens and the data.
 */
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import type { FastifyInstance } from "fastify";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

export function serveApp(app: FastifyInstance, dir: string) {
  const root = normalize(dir + sep);
  const fileAt = (urlPath: string) => {
    const file = normalize(join(root, decodeURIComponent(urlPath)));
    if (!file.startsWith(root)) return null; // never outside the app folder
    try {
      return statSync(file).isFile() ? file : null;
    } catch {
      return null;
    }
  };

  app.setNotFoundHandler((req, reply) => {
    const path = req.url.split("?")[0];
    if (req.method !== "GET" || path.startsWith("/api/"))
      return reply.code(404).send({ error: "Not found" });
    // A real file (script, style, icon)… or the app itself for any screen URL
    const file = fileAt(path) ?? join(root, "index.html");
    const hashed = path.startsWith("/assets/");
    return reply
      .header(
        "Content-Type",
        TYPES[extname(file)] ?? "application/octet-stream",
      )
      .header(
        "Cache-Control",
        hashed ? "public, max-age=31536000, immutable" : "no-cache",
      )
      .send(createReadStream(file));
  });
}
