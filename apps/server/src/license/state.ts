/**
 * Is this shop allowed to work right now?
 *
 *   trial    first 30 days after installing, no key needed
 *   active   valid key, before its last day (warning in the last 15 days)
 *   grace    up to 7 days after the last day — still works, red warning
 *   expired  after that, or trial over → ON HOLD: no new bills, purchases
 *            or changes. Viewing, reports, backups and entering a new key
 *            always keep working — the shop's own data is never locked.
 *   clock    the computer's date was moved back → on hold until fixed
 */
import type { DatabaseSync } from "node:sqlite";
import { checkKey, type LicenseData } from "./key";

export const TRIAL_DAYS = 30;
export const GRACE_DAYS = 7;
export const WARN_DAYS = 15;
const DAY = 86_400_000;

export type LicenseStatus =
  "off" | "trial" | "active" | "grace" | "expired" | "clock";

export type LicenseState = {
  status: LicenseStatus;
  /** Writes (new bills, purchases, changes) allowed? */
  canWork: boolean;
  /** Days until the hold starts (trial / active / grace) */
  daysLeft: number | null;
  message: string;
  machine: string;
  license: LicenseData | null;
  /** Max computers billing at once (null = no limit) */
  counters: number | null;
};

type Row = { value_json: string };
const read = <T>(raw: DatabaseSync, key: string): T | null => {
  const r = raw
    .prepare("SELECT value_json FROM settings WHERE key = ?")
    .get(key) as Row | undefined;
  try {
    return r ? (JSON.parse(r.value_json) as T) : null;
  } catch {
    return null;
  }
};
const write = (raw: DatabaseSync, key: string, value: unknown) =>
  raw
    .prepare(
      `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    )
    .run(key, JSON.stringify(value), new Date().toISOString());

export type LicenseOptions = {
  /** Installed app: on. Development / tests: off unless asked */
  enforce: boolean;
  publicKey: string;
  machine: string;
  now?: () => Date;
};

/** Last day 2027-10-08 → it works until the END of that day */
const endOfDay = (ymd: string) => Date.parse(`${ymd}T23:59:59.999`);

export function licenseState(
  raw: DatabaseSync,
  o: LicenseOptions,
): LicenseState {
  const base = { machine: o.machine, license: null, counters: null };
  if (!o.enforce)
    return {
      ...base,
      status: "off",
      canWork: true,
      daysLeft: null,
      message: "",
    };
  const now = (o.now ?? (() => new Date()))().getTime();

  // Clock moved back? (remember the latest time ever seen)
  const clock = read<{ lastSeen: number }>(raw, "license_clock");
  if (clock && now < clock.lastSeen - DAY)
    return {
      ...base,
      status: "clock",
      canWork: false,
      daysLeft: 0,
      message:
        "This computer's date/time is wrong (it was moved back). Set the correct date to continue.",
    };
  if (!clock || now - clock.lastSeen > 3_600_000)
    write(raw, "license_clock", {
      lastSeen: Math.max(now, clock?.lastSeen ?? 0),
    });

  const saved = read<{ key: string }>(raw, "license");
  const check = saved ? checkKey(saved.key, o.publicKey, o.machine) : null;
  if (check?.ok) {
    const d = check.data;
    const end = endOfDay(d.expiresAt);
    const left = Math.ceil((end - now) / DAY);
    const withLicense = { ...base, license: d, counters: d.counters };
    if (now <= end)
      return {
        ...withLicense,
        status: "active",
        canWork: true,
        daysLeft: left,
        message:
          left <= WARN_DAYS
            ? `Licence ends in ${left} day${left === 1 ? "" : "s"} (${d.expiresAt}) — renew in time.`
            : "",
      };
    const graceLeft = Math.ceil((end + GRACE_DAYS * DAY - now) / DAY);
    if (graceLeft > 0)
      return {
        ...withLicense,
        status: "grace",
        canWork: true,
        daysLeft: graceLeft,
        message: `Licence ended on ${d.expiresAt}. Billing stops in ${graceLeft} day${graceLeft === 1 ? "" : "s"} — renew now.`,
      };
    return {
      ...withLicense,
      status: "expired",
      canWork: false,
      daysLeft: 0,
      message: `Licence ended on ${d.expiresAt}. The software is on hold — enter a new licence key to continue. Your data is safe and can still be viewed and backed up.`,
    };
  }

  // No (valid) key → free trial from the first start
  let trial = read<{ startedAt: number }>(raw, "license_trial");
  if (!trial) {
    trial = { startedAt: now };
    write(raw, "license_trial", trial);
  }
  const left = Math.ceil((trial.startedAt + TRIAL_DAYS * DAY - now) / DAY);
  if (left > 0)
    return {
      ...base,
      status: "trial",
      canWork: true,
      daysLeft: left,
      counters: 1,
      message: `Trial: ${left} day${left === 1 ? "" : "s"} left. Enter a licence key in Settings → Licence.`,
    };
  return {
    ...base,
    status: "expired",
    canWork: false,
    daysLeft: 0,
    counters: 1,
    message:
      check && !check.ok
        ? `${check.reason}. The software is on hold — enter a valid licence key.`
        : "The free trial is over. The software is on hold — enter a licence key to continue. Your data is safe.",
  };
}

/** Save a key (only if it checks out for THIS computer) */
export function saveLicenseKey(
  raw: DatabaseSync,
  key: string,
  o: LicenseOptions,
) {
  const check = checkKey(key, o.publicKey, o.machine);
  if (check.ok) write(raw, "license", { key: key.trim() });
  return check;
}
