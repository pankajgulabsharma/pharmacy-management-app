/**
 * Starts the whole server: database (+ table updates), first owner
 * account, daily backups, API — and optionally the app screens.
 * Used by `npm run dev:server` (index.ts) and by the installed app.
 */
import { buildApp, defaultLicense } from "./app";
import { DEFAULT_BACKUP_DIR, DEFAULT_DB_FILE, openDatabase } from "./db/client";
import { ensureOwner } from "./auth/store";
import { startAutoBackup } from "./backup/backup";
import { copyOffsite } from "./backup/offsite";

export type ServerOptions = {
  dbFile?: string;
  backupDir?: string;
  /** 127.0.0.1 = this computer only; 0.0.0.0 = whole shop network */
  host?: string;
  port?: number;
  /** Built app screens to serve (installed app / other counters) */
  appDir?: string;
  /** Switch shop-network sharing (installed app) */
  setLan?: (enabled: boolean) => Promise<void>;
  log?: (msg: string) => void;
};

export async function startServer({
  dbFile = DEFAULT_DB_FILE,
  backupDir = DEFAULT_BACKUP_DIR,
  host = "127.0.0.1",
  port = 4000,
  appDir,
  setLan,
  log = console.log,
}: ServerOptions = {}) {
  const database = await openDatabase(dbFile);
  // A brand-new shop gets one owner account to start with
  if (await ensureOwner(database.raw))
    log(
      'First start: sign in as "admin" with password "admin" — you will be asked to choose a new password.',
    );
  const license = defaultLicense();
  // Every automatic backup also goes to the owner's Drive / pen drive folder
  const stopBackups = startAutoBackup(database.raw, backupDir, (b) => {
    copyOffsite(database.raw, backupDir, license, b);
  });
  const app = buildApp({
    database,
    backupDir,
    license,
    appDir,
    system: { lanEnabled: () => host === "0.0.0.0", setLan },
  });
  try {
    await app.listen({ port, host });
  } catch (err) {
    stopBackups();
    database.close();
    throw err;
  }
  return {
    app,
    database,
    dbFile,
    backupDir,
    /** Stop cleanly — the database file is never left half-written */
    close: async () => {
      stopBackups();
      await app.close();
      database.close();
    },
  };
}
