/**
 * npm run db:seed            → fills an EMPTY database with the demo shop
 * npm run db:seed -- --reset → deletes the database file first (demo only!)
 */
import { rmSync } from "node:fs";
import { DEFAULT_DB_FILE, openDatabase } from "../db/client";
import { hasData, seedDemoData } from "../db/seed";

const file = DEFAULT_DB_FILE;
if (process.argv.includes("--reset")) {
  // A running server keeps writing to the OLD file after it is deleted —
  // everything saved after the reset would be lost. Refuse instead.
  if (await serverIsRunning()) {
    console.error(
      "The server is running. Stop it first (Ctrl+C in its terminal), then reset.",
    );
    process.exit(1);
  }
  for (const f of [file, `${file}-wal`, `${file}-shm`])
    rmSync(f, { force: true });
  console.log("Old database deleted.");
}

const database = await openDatabase(file);
try {
  if (await hasData(database)) {
    console.log("The database already has data — nothing changed.");
    console.log("To start over with demo data:  npm run db:seed -- --reset");
  } else {
    const counts = await seedDemoData(database);
    console.log(`Demo data saved in ${file}`);
    console.table(counts);
  }
} finally {
  database.close();
}

async function serverIsRunning(): Promise<boolean> {
  try {
    const res = await fetch(
      `http://127.0.0.1:${process.env.PORT ?? 4000}/health`,
      { signal: AbortSignal.timeout(1500) },
    );
    return res.ok;
  } catch {
    return false;
  }
}
