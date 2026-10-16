/** What GET /api/backups answers (owner only) */

export type BackupKind =
  "auto" | "manual" | "before-restore" | "uploaded" | "year-end";
export type Backup = {
  name: string;
  kind: BackupKind;
  sizeBytes: number;
  createdAt: string;
};

export type PlaceKind = "cloud" | "drive" | "local";
export type Place = { label: string; path: string; kind: PlaceKind };

export type Offsite = {
  folder: string;
  target: string;
  lastCopyAt: string | null;
  lastCopied: string | null;
  lastError: string | null;
  kind: PlaceKind | null;
  connected: boolean;
};

export type DataInfo = {
  folder: string;
  sizeBytes: number;
  counts: {
    medicines: number;
    bills: number;
    customers: number;
    purchases: number;
    suppliers: number;
  };
};

export type BackupsResponse = {
  dir: string;
  keepAuto: number;
  backups: Backup[];
  offsite: Offsite;
  places: Place[];
  data: DataInfo;
};

export const fileSize = (b: number) =>
  b >= 1_048_576
    ? `${(b / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.ceil(b / 1024))} KB`;

export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Whole days between then and now */
export const daysSince = (iso: string, now = Date.now()) =>
  Math.floor((now - Date.parse(iso)) / 86_400_000);
