/**
 * Last way back in — the owner forgot the password AND has no recovery
 * code. The sign-in screen shows this computer's machine code and a
 * request number; the MediCare provider makes an unlock code for exactly
 * that (signed with the same private key as licence keys — nobody else can
 * make one). One use, valid 24 hours. No internet, no SMS, ₹0.
 *
 *   provider:  npm run license -- unlock --machine XXXX-… --request 123456
 */
import { createPublicKey, randomInt, verify } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

const KEY = "unlock_request";
const VALID_MS = 24 * 3_600_000;
type Saved = { request: string; at: number };

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

/** The open request (a new one after 24 h) */
export function unlockRequest(raw: DatabaseSync, now = Date.now()) {
  const s = read(raw);
  if (s && now - s.at < VALID_MS) return s.request;
  const request = String(randomInt(100_000, 1_000_000));
  raw
    .prepare(
      `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    )
    .run(
      KEY,
      JSON.stringify({ request, at: now }),
      new Date(now).toISOString(),
    );
  return request;
}

/** What the provider signs */
export const unlockMessage = (machine: string, request: string) =>
  `MU1|${machine}|${request}`;

/** Right code for this computer and the open request → used up (true) */
export function useUnlockCode(
  raw: DatabaseSync,
  code: string,
  publicKeyPem: string,
  machine: string,
  now = Date.now(),
): boolean {
  const s = read(raw);
  if (!s || now - s.at >= VALID_MS || !publicKeyPem) return false;
  const sig = code
    .trim()
    .replace(/\s+/g, "")
    .replace(/^MU1\./, "");
  let ok = false;
  try {
    ok = verify(
      null,
      Buffer.from(unlockMessage(machine, s.request)),
      createPublicKey(publicKeyPem),
      Buffer.from(sig, "base64url"),
    );
  } catch {
    ok = false;
  }
  if (ok) raw.prepare("DELETE FROM settings WHERE key = ?").run(KEY);
  return ok;
}
