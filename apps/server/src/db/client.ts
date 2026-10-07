import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import * as schema from "./schema";

export type Db = SqliteRemoteDatabase<typeof schema>;
export type Database = { db: Db; raw: DatabaseSync; close: () => void };

const HERE = dirname(fileURLToPath(import.meta.url));
/** Table-layout updates (the installed app points this at its own copy) */
export const MIGRATIONS_DIR = resolve(
  process.env.MIGRATIONS_DIR ?? resolve(HERE, "../../drizzle"),
);
export const DEFAULT_DB_FILE = resolve(
  process.env.DB_FILE ?? resolve(HERE, "../../data/medicare.sqlite"),
);
/** Backups live next to the database unless BACKUP_DIR says otherwise */
export const DEFAULT_BACKUP_DIR = resolve(
  process.env.BACKUP_DIR ?? resolve(dirname(DEFAULT_DB_FILE), "backups"),
);

/**
 * Opens (or creates) the shop database and brings its tables up to date.
 * Uses Node's built-in SQLite — nothing native to install or compile.
 * Pass ":memory:" for a throw-away database (tests).
 */
export async function openDatabase(
  file = DEFAULT_DB_FILE,
): Promise<Database> {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);

  // Safety & speed: WAL = crash-safe and readers don't block the till;
  // foreign keys ON = no bill line without its bill; wait instead of failing when busy
  raw.exec(
    "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;",
  );

  // Drizzle talks to node:sqlite through this small adapter
  const db = drizzle(
    async (query, params, method) => {
      const st = raw.prepare(query);
      if (method === "run") {
        st.run(...(params as never[]));
        return { rows: [] };
      }
      st.setReturnArrays(true);
      if (method === "get")
        return {
          rows: (st.get(...(params as never[])) ??
            undefined) as unknown as unknown[],
        };
      return { rows: st.all(...(params as never[])) as unknown[] };
    },
    { schema },
  );

  // Create / update tables from ./drizzle (all-or-nothing)
  await migrate(
    db,
    async (queries) => {
      raw.exec("BEGIN");
      try {
        for (const q of queries) raw.exec(q);
        raw.exec("COMMIT");
      } catch (err) {
        raw.exec("ROLLBACK");
        throw err;
      }
    },
    { migrationsFolder: MIGRATIONS_DIR },
  );

  return { db, raw, close: () => raw.close() };
}
