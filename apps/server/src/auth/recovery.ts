/**
 * Owner forgot the password — without SMS or e-mail (₹0, works offline):
 * the owner makes a recovery code once (Settings → Users), writes it down
 * and keeps it away from the computer. On the sign-in screen the code sets
 * a new owner password. One use only; only its slow hash is stored.
 */
import { randomInt } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  RECOVERY_ALPHABET,
  cleanRecoveryCode,
  formatRecoveryCode,
} from "@medicare/domain/auth/users";
import { hashPassword, verifyPassword } from "./password";

const KEY = "recovery_code";
type Saved = { hash: string; createdAt: string };

function read(raw: DatabaseSync): Saved | null {
  const r = raw
    .prepare("SELECT value_json FROM settings WHERE key = ?")
    .get(KEY) as { value_json: string } | undefined;
  try {
    return r ? (JSON.parse(r.value_json) as Saved) : null;
  } catch {
    return null;
  }
}

export const recoveryInfo = (raw: DatabaseSync) => ({
  createdAt: read(raw)?.createdAt ?? null,
});

/** A new code (the old one stops working). Shown once, never stored. */
export async function newRecoveryCode(raw: DatabaseSync, now = new Date()) {
  let code = "";
  for (let i = 0; i < 12; i++)
    code += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
  const saved: Saved = {
    hash: await hashPassword(code),
    createdAt: now.toISOString(),
  };
  raw
    .prepare(
      `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    )
    .run(KEY, JSON.stringify(saved), saved.createdAt);
  return { code: formatRecoveryCode(code), createdAt: saved.createdAt };
}

/** Right code → used up (true). Wrong / none → false. */
export async function useRecoveryCode(raw: DatabaseSync, typed: string) {
  const saved = read(raw);
  const ok = await verifyPassword(cleanRecoveryCode(typed), saved?.hash);
  if (!saved || !ok) return false;
  raw.prepare("DELETE FROM settings WHERE key = ?").run(KEY);
  return true;
}
