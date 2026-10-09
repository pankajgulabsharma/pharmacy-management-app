/**
 * A copy of every backup OUTSIDE this computer — so a stolen or broken
 * laptop never takes the shop's data with it. Free: the owner picks a
 * folder that leaves the computer by itself:
 *
 *   • Google Drive for desktop  → "G:\My Drive"   (15 GB free)
 *   • OneDrive                  → "C:\Users\…\OneDrive"
 *   • a pen drive / another PC's shared folder
 *
 * Into "<folder>\MediCare Backups\<shop> (<machine code>)\" go the zipped
 * backups (last 30 automatic + every manual / year-end one) and
 * LICENCE-INFO.txt: which shop and computer this is, the licence key and
 * what to do on a new computer.
 */
import {
  accessSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, hostname } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { RuleError } from "@medicare/domain/lib/errors";
import { loadSettings } from "../routes/settings";
import { licenseState, type LicenseOptions } from "../license/state";
import { KEEP_AUTO, listBackups, type BackupInfo } from "./backup";

const KEY = "backup_offsite";

export type OffsiteStatus = {
  /** Chosen folder ("" = not set up) */
  folder: string;
  /** Where the files actually go (folder\MediCare Backups\Shop (code)) */
  target: string;
  lastCopyAt: string | null;
  lastCopied: string | null;
  lastError: string | null;
};

type Saved = Omit<OffsiteStatus, "target">;
const EMPTY: Saved = {
  folder: "",
  lastCopyAt: null,
  lastCopied: null,
  lastError: null,
};

function read(raw: DatabaseSync): Saved {
  const r = raw
    .prepare("SELECT value_json FROM settings WHERE key = ?")
    .get(KEY) as { value_json: string } | undefined;
  try {
    return r ? { ...EMPTY, ...(JSON.parse(r.value_json) as Saved) } : EMPTY;
  } catch {
    return EMPTY;
  }
}
function save(raw: DatabaseSync, v: Saved) {
  raw
    .prepare(
      `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    )
    .run(KEY, JSON.stringify(v), new Date().toISOString());
}

/** Windows / file-system safe: "Sharma Medicals (7F3A-91KC-…)" */
const safe = (s: string) =>
  s
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\p{Cc}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60) || "Shop";

function targetOf(raw: DatabaseSync, folder: string, machine: string) {
  if (!folder) return "";
  const shop = loadSettings(raw).shop.name;
  return join(folder, "MediCare Backups", safe(`${shop} (${machine})`));
}

export function offsiteStatus(
  raw: DatabaseSync,
  lic: LicenseOptions,
): OffsiteStatus {
  const s = read(raw);
  return { ...s, target: targetOf(raw, s.folder, lic.machine) };
}

/** Can we write there? (folder exists or can be made, and is writable) */
function checkWritable(target: string) {
  try {
    mkdirSync(target, { recursive: true });
    accessSync(target, constants.W_OK);
    const probe = join(target, ".medicare-write-test");
    writeFileSync(probe, "ok");
    rmSync(probe, { force: true });
  } catch (err) {
    throw new RuleError(
      `Can't save backups in this folder (${(err as NodeJS.ErrnoException).code ?? "no access"}). Is the drive connected?`,
    );
  }
}

/** Owner picks (or clears, with "") the folder. Checked before saving. */
export function setOffsiteFolder(
  raw: DatabaseSync,
  lic: LicenseOptions,
  folder: string,
): OffsiteStatus {
  const f = folder.trim();
  if (f && !isAbsolute(f))
    throw new RuleError(
      'Give the full folder path, e.g. "G:\\My Drive" or "E:\\"',
    );
  const clean = f ? resolve(f) : "";
  if (clean) checkWritable(targetOf(raw, clean, lic.machine));
  save(raw, { ...EMPTY, folder: clean });
  return offsiteStatus(raw, lic);
}

const licenceText = (raw: DatabaseSync, lic: LicenseOptions, last: string) => {
  const st = licenseState(raw, lic);
  const keyRow = raw
    .prepare("SELECT value_json FROM settings WHERE key = 'license'")
    .get() as { value_json: string } | undefined;
  let key = "";
  try {
    key = keyRow ? (JSON.parse(keyRow.value_json) as { key: string }).key : "";
  } catch {
    /* no key */
  }
  const shop = loadSettings(raw).shop;
  const l = st.license;
  const status =
    st.status === "off"
      ? "not checked (development copy)"
      : l
        ? `${st.status} — valid till ${l.expiresAt} · ${l.counters} computer(s) · ${l.id}`
        : `${st.status}${st.daysLeft !== null ? ` — ${st.daysLeft} day(s) left` : ""}`;
  return [
    "MediCare Pharmacy — backup & licence details",
    "=============================================",
    `Shop:          ${shop.name}`,
    `GSTIN:         ${shop.gstin || "—"}`,
    `Computer:      ${hostname()}`,
    `Machine code:  ${lic.machine}`,
    `App version:   ${process.env.APP_VERSION ?? "development"}`,
    `Licence:       ${status}`,
    `Licence key:   ${key || "— (trial)"}`,
    `Last backup:   ${last}`,
    `Updated:       ${new Date().toLocaleString("en-IN")}`,
    "",
    "If this computer is lost, stolen or broken:",
    "1. Install MediCare on the new computer and choose “Main computer”.",
    "2. Settings → Backup & restore → “Bring a backup file” → pick the NEWEST",
    "   medicare-…sqlite.gz file in this folder → Restore.",
    "3. The licence is tied to the old computer. Send the NEW computer's",
    "   machine code (Settings → Licence) and this file to your MediCare",
    "   provider — they will send a new licence key.",
    "",
  ].join("\r\n");
};

/** Keep the folder tidy: last 30 automatic copies; others stay */
function prune(target: string) {
  const ours = readdirSync(target)
    .filter((n) => /^medicare-\d{8}-\d{6}-auto\.sqlite(\.gz)?$/.test(n))
    .sort()
    .reverse();
  for (const n of ours.slice(KEEP_AUTO))
    rmSync(join(target, n), { force: true });
}

/**
 * Copies one backup (and the licence details) to the chosen folder.
 * Never throws: a missing pen drive is recorded and shown in Settings.
 */
export function copyOffsite(
  raw: DatabaseSync,
  dir: string,
  lic: LicenseOptions,
  backup: BackupInfo,
): OffsiteStatus {
  const s = read(raw);
  if (!s.folder) return offsiteStatus(raw, lic);
  const target = targetOf(raw, s.folder, lic.machine);
  try {
    mkdirSync(target, { recursive: true });
    const part = join(target, `${backup.name}.part`);
    copyFileSync(join(dir, backup.name), part);
    renameSync(part, join(target, backup.name));
    writeFileSync(
      join(target, "LICENCE-INFO.txt"),
      licenceText(raw, lic, backup.name),
    );
    prune(target);
    save(raw, {
      ...s,
      lastCopyAt: new Date().toISOString(),
      lastCopied: backup.name,
      lastError: null,
    });
  } catch (err) {
    save(raw, {
      ...s,
      lastError: `Copy failed: ${(err as NodeJS.ErrnoException).code ?? (err as Error).message}. Is the drive connected?`,
    });
  }
  return offsiteStatus(raw, lic);
}

/** "Copy now": the newest backup goes to the folder again */
export function copyNewest(
  raw: DatabaseSync,
  dir: string,
  lic: LicenseOptions,
) {
  const newest = listBackups(dir).find((b) => b.kind !== "before-restore");
  if (!newest) throw new RuleError("Make a backup first");
  return copyOffsite(raw, dir, lic, newest);
}

/**
 * Folders on THIS computer that leave it by themselves (cloud sync), to
 * pick with one click. Only ones that exist are offered.
 */
export function suggestedFolders(): { label: string; path: string }[] {
  const home = homedir();
  const out: { label: string; path: string }[] = [];
  const add = (label: string, path: string | undefined) => {
    if (path && existsSync(path) && !out.some((o) => o.path === path))
      out.push({ label, path });
  };
  if (process.platform === "win32") {
    // Google Drive for desktop: a drive letter (G: by default) with "My Drive"
    for (const l of "GHIJKLMNOPQRSTUVWXYZDEF")
      add("Google Drive", `${l}:\\My Drive`);
    add("OneDrive", process.env.OneDrive);
    add("OneDrive", process.env.OneDriveConsumer);
  }
  add("Google Drive", join(home, "Google Drive"));
  add("Google Drive", join(home, "My Drive"));
  add("OneDrive", join(home, "OneDrive"));
  add("Dropbox", join(home, "Dropbox"));
  return out;
}
