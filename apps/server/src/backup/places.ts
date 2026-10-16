/**
 * Where can the second copy of the backups go? Folders that LEAVE this
 * computer by themselves — so the owner picks one with a click instead of
 * typing a path:
 *
 *   • cloud — Google Drive / OneDrive / Dropbox folders (they sync online)
 *   • drive — pen drives and other disks plugged into this computer
 *   • local — anything else on this computer's own disk (no protection if
 *             the computer is stolen or breaks; the screen warns)
 *
 * Plus a small folder browser, so any folder can be chosen from any
 * counter (the files are written on the main computer, where this runs).
 */
import { execFileSync } from "node:child_process";
import { readdirSync, realpathSync, statSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { RuleError } from "@medicare/domain/lib/errors";

export type PlaceKind = "cloud" | "drive" | "local";
export type Place = { label: string; path: string; kind: PlaceKind };

const isDir = (p: string) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const subDirs = (p: string) => {
  try {
    return readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => join(p, d.name));
  } catch {
    return [];
  }
};

/** Cloud folders that exist on this computer */
export function cloudFolders(
  home = homedir(),
  env: NodeJS.ProcessEnv = process.env,
  platform = process.platform,
): Place[] {
  const out: Place[] = [];
  const add = (label: string, path: string | undefined) => {
    if (path && isDir(path) && !out.some((o) => o.path === path))
      out.push({ label, path, kind: "cloud" });
  };
  if (platform === "win32") {
    // Google Drive for desktop: a drive letter (G: by default) with "My Drive"
    for (const l of "GHIJKLMNOPQRSTUVWXYZDEF")
      add("Google Drive", `${l}:\\My Drive`);
    add("OneDrive", env.OneDrive);
    add("OneDrive", env.OneDriveConsumer);
  }
  add("Google Drive", join(home, "Google Drive"));
  add("Google Drive", join(home, "My Drive"));
  add("OneDrive", join(home, "OneDrive"));
  add("Dropbox", join(home, "Dropbox"));
  // macOS: Google Drive / OneDrive live under CloudStorage
  for (const p of subDirs(join(home, "Library", "CloudStorage"))) {
    const n = basename(p);
    if (n.startsWith("GoogleDrive"))
      add("Google Drive", isDir(join(p, "My Drive")) ? join(p, "My Drive") : p);
    else if (n.startsWith("OneDrive")) add("OneDrive", p);
    else if (n.startsWith("Dropbox")) add("Dropbox", p);
  }
  return out;
}

let driveCache: {
  at: number;
  map: Map<string, { type: number; name: string }>;
} | null = null;

/**
 * Windows: which letters are pen drives (2), disks inside this computer
 * (3) or network drives (4) — asked once a minute, never blocks for long.
 */
function windowsDriveTypes() {
  if (driveCache && Date.now() - driveCache.at < 60_000) return driveCache.map;
  const map = new Map<string, { type: number; name: string }>();
  try {
    const json = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,DriveType,VolumeName | ConvertTo-Json -Compress",
      ],
      { encoding: "utf8", timeout: 5000, windowsHide: true },
    );
    const rows = JSON.parse(json) as
      | { DeviceID: string; DriveType: number; VolumeName: string | null }
      | { DeviceID: string; DriveType: number; VolumeName: string | null }[];
    for (const r of Array.isArray(rows) ? rows : [rows])
      map.set(r.DeviceID.toUpperCase(), {
        type: r.DriveType,
        name: (r.VolumeName ?? "").trim(),
      });
  } catch {
    /* PowerShell missing / slow: letters are still listed, without types */
  }
  driveCache = { at: Date.now(), map };
  return map;
}

/** Pen drives and other disks plugged in (not the system disk) */
export function otherDrives(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Place[] {
  if (platform === "win32") {
    const system = (env.SystemDrive ?? "C:").toUpperCase();
    const types = windowsDriveTypes();
    const out: Place[] = [];
    for (const l of "DEFGHIJKLMNOPQRSTUVWXYZAB") {
      const id = `${l}:`;
      const root = `${l}:\\`;
      // G: with "My Drive" is Google Drive — listed as cloud
      if (id === system || isDir(`${root}My Drive`) || !isDir(root)) continue;
      const t = types.get(id);
      const name = t?.name ? ` (${t.name})` : "";
      // A D: partition is the same disk inside this computer: no protection
      if (t?.type === 3)
        out.push({ label: `Drive ${id}${name}`, path: root, kind: "local" });
      else
        out.push({
          label:
            t?.type === 4
              ? `Network drive ${id}${name}`
              : t?.type === 2
                ? `Pen drive ${id}${name}`
                : `Drive ${id}${name}`,
          path: root,
          kind: "drive",
        });
    }
    return out;
  }
  let user = "";
  try {
    user = userInfo().username;
  } catch {
    /* no user name */
  }
  const roots =
    platform === "darwin"
      ? subDirs("/Volumes").filter((p) => {
          try {
            return realpathSync(p) !== "/"; // "Macintosh HD" is the system disk
          } catch {
            return false;
          }
        })
      : [
          ...subDirs(join("/media", user)),
          ...subDirs(join("/run/media", user)),
          ...subDirs("/mnt"),
        ];
  return roots.map((p) => ({ label: basename(p), path: p, kind: "drive" }));
}

/** Everything the owner can pick from, best first */
export function places(): Place[] {
  return [
    ...cloudFolders(),
    ...otherDrives(),
    { label: "This computer", path: homedir(), kind: "local" },
  ];
}

const within = (path: string, root: string) => {
  const a = resolve(path).toLowerCase();
  const b = resolve(root).toLowerCase();
  return a === b || a.startsWith(b.endsWith(sep) ? b : b + sep);
};

/** Does this folder leave the computer? (cloud / other drive / local disk) */
export function kindOf(
  folder: string,
  known: Place[] = [...cloudFolders(), ...otherDrives()],
): PlaceKind {
  const match = known
    .filter((p) => p.kind !== "local" && within(folder, p.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.kind ?? "local";
}

const HIDDEN = new Set([
  "$recycle.bin",
  "system volume information",
  "appdata",
  "node_modules",
]);
const MAX_FOLDERS = 400;

/** One level of folders, for the folder picker */
export function browse(path: string): {
  path: string;
  parent: string | null;
  folders: string[];
} {
  if (!isAbsolute(path)) throw new RuleError("Unknown folder");
  const p = resolve(path);
  let names: string[];
  try {
    names = readdirSync(p, { withFileTypes: true })
      .filter(
        (d) =>
          d.isDirectory() &&
          !d.name.startsWith(".") &&
          !d.name.startsWith("$") &&
          !HIDDEN.has(d.name.toLowerCase()),
      )
      .map((d) => d.name);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    throw new RuleError(
      code === "ENOENT"
        ? "This folder isn't there any more — is the drive connected?"
        : "Can't open this folder",
    );
  }
  names.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  const parent = dirname(p);
  return {
    path: p,
    parent: parent === p ? null : parent,
    folders: names.slice(0, MAX_FOLDERS),
  };
}
