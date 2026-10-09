/**
 * Backups: a full copy of the shop database in one file.
 *
 *  • Made with SQLite's "VACUUM INTO" — a consistent snapshot even while
 *    counters keep billing (nothing is locked for long).
 *  • Automatic once a day (kept: last 30), plus "Backup now", plus a safety
 *    copy before every restore — so a restore can itself be undone.
 *  • Zipped (gzip): a 100 MB database becomes a ~10 MB file. Older plain
 *    ".sqlite" backups still list, download and restore.
 *  • Year-end: the first backup of every financial year (1 April) is kept
 *    for ever — the books as they were at the close of the year.
 *  • Restore copies the backup's data INTO the open database inside one
 *    transaction: all of it, or nothing. Older backups are first brought
 *    up to the current table layout (migrations), so they always fit.
 */
import {
  copyFileSync,
  createReadStream,
  createWriteStream,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip, gunzipSync } from "node:zlib";
import { financialYear } from "@medicare/domain/lib/docNo";
import { RuleError } from "@medicare/domain/lib/errors";
import { openDatabase } from "../db/client";

export type BackupKind =
  "auto" | "manual" | "before-restore" | "uploaded" | "year-end";
export type BackupInfo = {
  name: string;
  kind: BackupKind;
  sizeBytes: number;
  createdAt: string;
};

/** How many automatic backups to keep (manual ones are never deleted) */
export const KEEP_AUTO = 30;
const NAME_RE =
  /^medicare-\d{8}-\d{6}-(auto|manual|before-restore|uploaded|year-end)\.sqlite(\.gz)?$/;
const isGz = (name: string) => name.endsWith(".gz");
/** Tables that are never copied back: sign-ins stay as they are now */
const SKIP_TABLES = new Set(["sessions", "__drizzle_migrations"]);

const stamp = (d: Date) =>
  d.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

/** Only our own file names — never a path from outside the backup folder */
export function checkName(name: string): string {
  if (!NAME_RE.test(name)) throw new RuleError("Unknown backup file");
  return name;
}

export function listBackups(dir: string): BackupInfo[] {
  let names: string[] = [];
  try {
    names = readdirSync(dir).filter((n) => NAME_RE.test(n));
  } catch {
    return []; // folder not made yet
  }
  return names
    .map((name) => {
      const st = statSync(join(dir, name));
      return {
        name,
        kind: NAME_RE.exec(name)![1] as BackupKind,
        sizeBytes: st.size,
        createdAt: st.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

/** A name not used yet ("-auto.sqlite.gz"); two in one second → next second */
function freeName(dir: string, kind: BackupKind, now: Date) {
  const taken = new Set(
    listBackups(dir).map((b) => b.name.replace(/\.gz$/, "")),
  );
  for (let i = 0; ; i++) {
    const n = `medicare-${stamp(new Date(now.getTime() + i * 1000))}-${kind}.sqlite`;
    if (!taken.has(n)) return `${n}.gz`;
  }
}

/** Zips `src` into `dest` (written to a temp name first: never half a file) */
async function gzipFile(src: string, dest: string) {
  const part = `${dest}.part`;
  try {
    await pipeline(
      createReadStream(src),
      createGzip({ level: 6 }),
      createWriteStream(part),
    );
    renameSync(part, dest);
  } finally {
    rmSync(part, { force: true });
  }
}

export async function createBackup(
  raw: DatabaseSync,
  dir: string,
  kind: Exclude<BackupKind, "uploaded">,
  now = new Date(),
): Promise<BackupInfo> {
  mkdirSync(dir, { recursive: true });
  const name = freeName(dir, kind, now);
  const temp = join(dir, `.snapshot-${process.pid}-${Date.now()}.sqlite`);
  try {
    raw.prepare("VACUUM INTO ?").run(temp);
    await gzipFile(temp, join(dir, name));
  } finally {
    rmSync(temp, { force: true });
  }
  if (kind === "auto") pruneAuto(dir);
  return listBackups(dir).find((b) => b.name === name)!;
}

/** A plain database copy of a backup (unzipped if needed), in a temp file */
async function plainCopy(dir: string, name: string): Promise<string> {
  const temp = join(dir, `.open-${process.pid}-${Date.now()}.sqlite`);
  if (isGz(name))
    await pipeline(
      createReadStream(join(dir, name)),
      createGunzip(),
      createWriteStream(temp),
    );
  else copyFileSync(join(dir, name), temp);
  return temp;
}

const removeDb = (file: string) => {
  for (const f of [file, `${file}-wal`, `${file}-shm`])
    rmSync(f, { force: true });
};

function pruneAuto(dir: string) {
  for (const b of listBackups(dir)
    .filter((x) => x.kind === "auto")
    .slice(KEEP_AUTO))
    rmSync(join(dir, b.name), { force: true });
}

/** Is this file really a MediCare database, and undamaged? */
export function checkBackupFile(file: string) {
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(file, { readOnly: true });
    const ok = (
      db.prepare("PRAGMA quick_check").get() as Record<string, string>
    ).quick_check;
    if (ok !== "ok") throw new Error("damaged");
    const tables = new Set(
      (
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all() as {
          name: string;
        }[]
      ).map((t) => t.name),
    );
    for (const t of ["medicines", "batches", "sales", "purchases", "settings"])
      if (!tables.has(t)) throw new Error("not ours");
  } catch {
    throw new RuleError(
      "This file is not a MediCare backup (or it is damaged)",
    );
  } finally {
    db?.close();
  }
}

/**
 * A file brought from a pen drive / Google Drive / another PC (zipped or
 * not) → checked, then kept (zipped) as a backup.
 */
export async function saveUploadedBackup(
  dir: string,
  bytes: Buffer,
  now = new Date(),
): Promise<BackupInfo> {
  mkdirSync(dir, { recursive: true });
  const zipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const temp = join(dir, `.upload-${process.pid}-${Date.now()}.sqlite`);
  try {
    let plain: Buffer;
    try {
      plain = zipped ? gunzipSync(bytes) : bytes;
    } catch {
      throw new RuleError(
        "This file is not a MediCare backup (or it is damaged)",
      );
    }
    writeFileSync(temp, plain);
    checkBackupFile(temp);
    const name = freeName(dir, "uploaded", now);
    if (zipped) writeFileSync(join(dir, name), bytes);
    else await gzipFile(temp, join(dir, name));
    return listBackups(dir).find((b) => b.name === name)!;
  } finally {
    removeDb(temp);
  }
}

const columns = (raw: DatabaseSync, schema: string, table: string) =>
  (
    raw.prepare(`PRAGMA ${schema}.table_info("${table}")`).all() as {
      name: string;
    }[]
  ).map((c) => c.name);

/**
 * Replace the shop's data with a backup. Makes a safety backup first, so
 * "restore" can be undone by restoring that one. Returns the safety copy.
 */
export async function restoreBackup(
  raw: DatabaseSync,
  dir: string,
  name: string,
  now = new Date(),
): Promise<BackupInfo> {
  if (!listBackups(dir).some((b) => b.name === checkName(name)))
    throw new RuleError("Unknown backup file");

  // 1) Bring a COPY of the backup up to today's table layout
  const temp = await plainCopy(dir, name);
  try {
    checkBackupFile(temp);
    const upgraded = await openDatabase(temp);
    upgraded.raw.exec("PRAGMA journal_mode = DELETE");
    upgraded.close();

    // 2) Safety copy of what we have now
    const safety = await createBackup(raw, dir, "before-restore", now);

    // 3) Copy every table across — one transaction, all or nothing
    raw.exec("PRAGMA foreign_keys = OFF");
    raw.prepare("ATTACH DATABASE ? AS bak").run(temp);
    try {
      raw.exec("BEGIN IMMEDIATE");
      try {
        const tables = (
          raw
            .prepare(
              "SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
            )
            .all() as { name: string }[]
        )
          .map((t) => t.name)
          .filter((t) => !SKIP_TABLES.has(t));
        for (const t of tables) {
          const theirs = new Set(columns(raw, "bak", t));
          const cols = columns(raw, "main", t).filter((c) => theirs.has(c));
          raw.exec(`DELETE FROM main."${t}"`);
          if (cols.length === 0) continue;
          const list = cols.map((c) => `"${c}"`).join(", ");
          raw.exec(
            `INSERT INTO main."${t}" (${list}) SELECT ${list} FROM bak."${t}"`,
          );
        }
        // People who no longer exist in the backup are signed out
        raw.exec(
          "DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users)",
        );
        const broken = raw.prepare("PRAGMA main.foreign_key_check").all();
        if (broken.length) throw new Error("backup has broken links");
        raw.exec("COMMIT");
      } catch (err) {
        raw.exec("ROLLBACK");
        throw new RuleError(
          `Restore failed — nothing was changed (${(err as Error).message})`,
        );
      }
    } finally {
      raw.exec("DETACH DATABASE bak");
      raw.exec("PRAGMA foreign_keys = ON");
    }
    return safety;
  } finally {
    removeDb(temp);
  }
}

/** Newest automatic backup older than this → make a new one */
const DAY_MS = 20 * 3_600_000;

/** First run in a new financial year with last year's bills → keep a copy */
function needsYearEnd(raw: DatabaseSync, dir: string, now: Date) {
  const fy = financialYear(now);
  const since = stamp(fy.from).slice(0, 8);
  if (
    listBackups(dir).some(
      (b) => b.kind === "year-end" && b.name.slice(9, 17) >= since,
    )
  )
    return false;
  return !!raw
    .prepare("SELECT 1 FROM sales WHERE created_at < ? LIMIT 1")
    .get(fy.from.toISOString());
}

/**
 * Daily automatic backup: checks at start and every hour; makes one when
 * the newest automatic backup is ~a day old (and a year-end one on the
 * first day of a new financial year). `after` gets every new backup (e.g.
 * to copy it to Google Drive / a pen drive). Never stops the server if a
 * backup fails (e.g. disk full) — it just tries again next hour.
 */
export function startAutoBackup(
  raw: DatabaseSync,
  dir: string,
  after: (b: BackupInfo) => void | Promise<void> = () => {},
) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const now = new Date();
      if (needsYearEnd(raw, dir, now))
        await after(await createBackup(raw, dir, "year-end", now));
      const last = listBackups(dir).find((b) => b.kind === "auto");
      if (!last || now.getTime() - Date.parse(last.createdAt) > DAY_MS)
        await after(await createBackup(raw, dir, "auto", now));
    } catch (err) {
      console.error("Automatic backup failed:", (err as Error).message);
    } finally {
      running = false;
    }
  };
  const first = tick();
  const timer = setInterval(() => void tick(), 3_600_000);
  timer.unref();
  return Object.assign(() => clearInterval(timer), { first });
}
