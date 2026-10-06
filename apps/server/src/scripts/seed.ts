/**
 * npm run db:seed            → fills an EMPTY database with the demo shop
 * npm run db:seed -- --reset → deletes the database file first (demo only!)
 */
import { rmSync } from "node:fs";
import { DEFAULT_DB_FILE, openDatabase } from "../db/client";
import { hasData, seedDemoData } from "../db/seed";

const file = process.env.DB_FILE ?? DEFAULT_DB_FILE;
if (process.argv.includes("--reset")) {
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
