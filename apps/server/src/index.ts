import { buildApp } from "./app";
import { DEFAULT_DB_FILE, openDatabase } from "./db/client";
import { ensureOwner } from "./auth/store";

/**
 * Starts the server. Listens on THIS computer only (127.0.0.1) by default —
 * sharing it with other counters on the LAN will be an explicit setting.
 */
const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "127.0.0.1";
const DB_FILE = process.env.DB_FILE ?? DEFAULT_DB_FILE;

const database = await openDatabase(DB_FILE);
// A brand-new shop gets one owner account to start with
if (await ensureOwner(database.raw)) {
  console.log(
    'First start: sign in as "admin" with password "admin" — you will be asked to choose a new password.',
  );
}
const app = buildApp({ database });

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(
    `MediCare server running → http://${HOST === "127.0.0.1" ? "localhost" : HOST}:${PORT}/health`,
  );
  console.log(`Database: ${DB_FILE}`);
} catch (err) {
  console.error(
    "Could not start the server:",
    err instanceof Error ? err.message : err,
  );
  database.close();
  process.exit(1);
}

// Close cleanly on Ctrl+C / system shutdown — the database file is never left half-written
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void app.close().then(() => {
      database.close();
      process.exit(0);
    });
  });
}
