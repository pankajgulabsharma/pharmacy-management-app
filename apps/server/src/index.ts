import { buildApp } from "./app";

/**
 * Starts the server. Listens on THIS computer only (127.0.0.1) by default —
 * sharing it with other counters on the LAN will be an explicit setting.
 */
const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "127.0.0.1";

const app = buildApp();

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`MediCare server running → http://${HOST === "127.0.0.1" ? "localhost" : HOST}:${PORT}/health`);
} catch (err) {
  console.error("Could not start the server:", err instanceof Error ? err.message : err);
  process.exit(1);
}

// Close cleanly on Ctrl+C / system shutdown (important once a database is open)
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
