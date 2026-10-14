/**
 * Medicine Library: a read-only, searchable list of ~2.4 lakh Indian
 * medicines, kept in its own small database next to the shop's (never in
 * the shop database or its backups).
 *
 * Shipped as library/medicines.tsv.br; on first start (and whenever a new
 * version of that file arrives with an update) it is turned into a
 * full-text index in the background — the till never waits for it.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliDecompressSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import type { LibraryItem } from "@medicare/domain/medicines/library";

const HERE = dirname(fileURLToPath(import.meta.url));
/** The installed app ships its own copy (LIBRARY_DATA, read at start) */
const libraryData = () =>
  resolve(
    process.env.LIBRARY_DATA ?? resolve(HERE, "../../library/medicines.tsv.br"),
  );

export type LibraryStatus = "ready" | "building" | "missing";

export type Library = {
  status: () => LibraryStatus;
  search: (q: string, limit?: number) => LibraryItem[];
  close: () => void;
};

const ROWS_PER_TICK = 5_000;

type Row = {
  id: number;
  name: string;
  company: string;
  mrp: number;
  pack: string;
  salt: string;
};
const toItem = (r: Row): LibraryItem => ({
  id: r.id,
  name: r.name,
  company: r.company,
  mrpPaise: r.mrp,
  pack: r.pack,
  salt: r.salt,
});

/** "dolo 650" → `"dolo"* "650"*` (every word, as a prefix; never raw FTS syntax) */
export function ftsQuery(q: string): string | null {
  const words =
    q
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.slice(0, 6) ?? [];
  if (words.join("").length < 2) return null;
  return words.map((w) => `"${w}"*`).join(" ");
}

function versionOf(dataFile: string) {
  return createHash("sha1").update(readFileSync(dataFile)).digest("hex");
}

function openReady(file: string, version: string): DatabaseSync | null {
  if (!existsSync(file)) return null;
  try {
    const db = new DatabaseSync(file, { readOnly: true });
    const row = db
      .prepare("SELECT value FROM meta WHERE key = 'version'")
      .get() as { value: string } | undefined;
    if (row?.value === version) return db;
    db.close();
  } catch {
    /* broken or old → rebuild */
  }
  return null;
}

/**
 * Builds the index into `<file>-building`, a few thousand rows per tick so
 * the server keeps answering, then swaps it in.
 */
async function build(dataFile: string, file: string, version: string) {
  const tmp = `${file}-building`;
  rmSync(tmp, { force: true });
  const db = new DatabaseSync(tmp);
  try {
    db.exec(`
      PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE VIRTUAL TABLE med USING fts5(
        name, salt, company UNINDEXED, mrp UNINDEXED, pack UNINDEXED,
        tokenize = 'unicode61 remove_diacritics 2', prefix = '2 3'
      );`);
    const lines = brotliDecompressSync(readFileSync(dataFile))
      .toString("utf8")
      .split("\n");
    const ins = db.prepare(
      "INSERT INTO med (name, salt, company, mrp, pack) VALUES (?, ?, ?, ?, ?)",
    );
    for (let i = 1; i < lines.length; i += ROWS_PER_TICK) {
      db.exec("BEGIN");
      for (const line of lines.slice(i, i + ROWS_PER_TICK)) {
        const [name, company = "", mrp = "0", pack = "", salt = ""] =
          line.split("\t");
        if (name) ins.run(name, salt, company, Number(mrp) || 0, pack);
      }
      db.exec("COMMIT");
      await new Promise((r) => setImmediate(r));
    }
    db.exec("INSERT INTO med (med) VALUES ('optimize')");
    db.prepare("INSERT INTO meta VALUES ('version', ?)").run(version);
  } finally {
    db.close();
  }
  rmSync(file, { force: true });
  renameSync(tmp, file);
}

export function openLibrary(
  file: string,
  dataFile = libraryData(),
  log: (msg: string) => void = console.log,
): Library {
  let db: DatabaseSync | null = null;
  let status: LibraryStatus = "missing";
  let closed = false;

  if (existsSync(dataFile)) {
    const version = versionOf(dataFile);
    db = openReady(file, version);
    status = db ? "ready" : "building";
    if (!db)
      build(dataFile, file, version)
        .then(() => {
          if (closed) return;
          db = openReady(file, version);
          status = db ? "ready" : "missing";
          log("Medicine Library ready");
        })
        .catch((err: unknown) => {
          status = "missing";
          log(`Medicine Library could not be built: ${String(err)}`);
        });
  }

  return {
    status: () => status,
    search(q, limit = 20) {
      const match = ftsQuery(q);
      if (!db || !match) return [];
      // Name = the typed word(s) first ("Dolo 650" before "Dolowin"),
      // then names starting with it, then best match
      const typed = q.trim().replace(/\s+/g, " ").replace(/[\\%_]/g, "\\$&");
      const rows = db
        .prepare(
          `SELECT rowid AS id, name, company, mrp, pack, salt FROM med
           WHERE med MATCH ?
           ORDER BY (name LIKE ? ESCAPE '\\') + (name LIKE ? ESCAPE '\\') DESC,
             bm25(med, 10.0, 2.0), length(name)
           LIMIT ?`,
        )
        .all(
          match,
          `${typed} %`,
          `${typed}%`,
          Math.min(Math.max(limit, 1), 50),
        ) as Row[];
      return rows.map(toItem);
    },
    close: () => {
      closed = true;
      db?.close();
      db = null;
    },
  };
}
