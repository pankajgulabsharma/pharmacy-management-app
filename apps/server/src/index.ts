import { startServer } from "./server";

/**
 * `npm run dev:server`. Listens on THIS computer only (127.0.0.1) unless
 * HOST says otherwise (e.g. HOST=0.0.0.0 to share with the shop network).
 * APP_DIR = built app screens to serve as well (optional).
 */
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 4000);

try {
  const server = await startServer({ host, port, appDir: process.env.APP_DIR });
  const shown = host === "127.0.0.1" || host === "0.0.0.0" ? "localhost" : host;
  console.log(`MediCare server running → http://${shown}:${port}/health`);
  console.log(`Database: ${server.dbFile}`);
  console.log(`Backups:  ${server.backupDir}`);

  // Close cleanly on Ctrl+C / system shutdown
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => void server.close().then(() => process.exit(0)));
} catch (err) {
  console.error(
    "Could not start the server:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
}
