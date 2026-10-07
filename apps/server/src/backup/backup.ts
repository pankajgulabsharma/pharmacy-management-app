/**
 * Backups: a full copy of the shop database in one file.
 *
 *  • Made with SQLite's "VACUUM INTO" — a consistent snapshot even while
 *    counters keep billing (nothing is locked for long).
 *  • Automatic once a day (kept: last 30), plus "Backup now", plus a safety
 *    copy before every restore — so a restore can itself be undone.
 *  • Restore copies the backup's data INTO the open database inside one
 *    transaction: all of it, or nothing. Older backups are first brought
 *    up to the current table layout (migrations), so they always fit.
 */
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { RuleError } from "@medicare/domain/lib/errors";
import { openDatabase } from "../db/client";

export type BackupKind = "auto" | "manual" | "before-restore" | "uploaded";
export type BackupInfo = {
  name: string;
  kind: BackupKind;
  sizeBytes: number;
  createdAt: string;
};

/** How many automatic backups to keep (manual ones are never deleted) */
export const KEEP_AUTO = 30;
const NAME_RE =
  /^medicare-\d{8}-\d{6}-(auto|manual|before-restore|uploaded)\.sqlite$/;
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

export function createBackup(
  raw: DatabaseSync,
  dir: string,
  kind: Exclude<BackupKind, "uploaded">,
  now = new Date(),
): BackupInfo {
  mkdirSync(dir, { recursive: true });
  let name = `medicare-${stamp(now)}-${kind}.sqlite`;
  // Two in the same second (rare) → wait-free unique name
  for (let i = 1; listBackups(dir).some((b) => b.name === name); i++)
    name = `medicare-${stamp(new Date(now.getTime() + i * 1000))}-${kind}.sqlite`;
  raw.prepare("VACUUM INTO ?").run(join(dir, name));
  if (kind === "auto") pruneAuto(dir);
  return listBackups(dir).find((b) => b.name === name)!;
}

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

/** A file brought from a pen drive / another PC → checked, then kept as a backup */
export function saveUploadedBackup(
  dir: string,
  bytes: Buffer,
  now = new Date(),
): BackupInfo {
  mkdirSync(dir, { recursive: true });
  const name = `medicare-${stamp(now)}-uploaded.sqlite`;
  const file = join(dir, name);
  writeFileSync(file, bytes);
  try {
    checkBackupFile(file);
  } catch (err) {
    rmSync(file, { force: true });
    throw err;
  }
  return listBackups(dir).find((b) => b.name === name)!;
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
  const src = join(dir, checkName(name));
  checkBackupFile(src);

  // 1) Bring a COPY of the backup up to today's table layout
  const temp = join(dir, `.restore-${process.pid}-${Date.now()}.sqlite`);
  copyFileSync(src, temp);
  try {
    const upgraded = await openDatabase(temp);
    upgraded.raw.exec("PRAGMA journal_mode = DELETE");
    upgraded.close();

    // 2) Safety copy of what we have now
    const safety = createBackup(raw, dir, "before-restore", now);

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
    for (const f of [temp, `${temp}-wal`, `${temp}-shm`])
      rmSync(f, { force: true });
  }
}

/** Newest automatic backup older than this → make a new one */
const DAY_MS = 20 * 3_600_000;

/**
 * Daily automatic backup: checks at start and every hour; makes one when
 * the newest automatic backup is ~a day old. Never stops the server if a
 * backup fails (e.g. disk full) — it just tries again next hour.
 */
export function startAutoBackup(raw: DatabaseSync, dir: string) {
  const tick = () => {
    try {
      const last = listBackups(dir).find((b) => b.kind === "auto");
      if (!last || Date.now() - Date.parse(last.createdAt) > DAY_MS)
        createBackup(raw, dir, "auto");
    } catch (err) {
      console.error("Automatic backup failed:", (err as Error).message);
    }
  };
  tick();
  const timer = setInterval(tick, 3_600_000);
  timer.unref();
  return () => clearInterval(timer);
}
