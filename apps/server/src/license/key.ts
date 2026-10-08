/**
 * Licence keys: "MC1.<data>.<signature>" — the data (shop, computer,
 * expiry, counters) is signed with the provider's private key (Ed25519).
 * Changing even one letter breaks the signature, so a key can't be
 * edited or made up — only checked, with the public key.
 */
import { createPublicKey, verify } from "node:crypto";

export type LicenseData = {
  v: 1;
  /** Licence number (for the provider's records) */
  id: string;
  /** Shop the licence was sold to */
  shop: string;
  /** Machine code of the main computer, or "*" (any computer) */
  machine: string;
  /** YYYY-MM-DD */
  issuedAt: string;
  /** YYYY-MM-DD — last day it works (then grace days) */
  expiresAt: string;
  /** How many computers may bill at the same time (main computer included) */
  counters: number;
};

const b64 = (s: string) => Buffer.from(s, "base64url");

export type KeyCheck =
  { ok: true; data: LicenseData } | { ok: false; reason: string };

export function checkKey(
  key: string,
  publicKeyPem: string,
  machine: string,
): KeyCheck {
  const parts = key.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "MC1")
    return { ok: false, reason: "This is not a MediCare licence key" };
  if (!publicKeyPem)
    return {
      ok: false,
      reason: "This copy of the app can't check licence keys",
    };
  let good = false;
  try {
    good = verify(
      null,
      Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey(publicKeyPem),
      b64(parts[2]),
    );
  } catch {
    good = false;
  }
  if (!good)
    return {
      ok: false,
      reason: "Licence key is not valid (check it was copied fully)",
    };
  let data: LicenseData;
  try {
    data = JSON.parse(b64(parts[1]).toString("utf8")) as LicenseData;
  } catch {
    return { ok: false, reason: "Licence key is damaged" };
  }
  if (
    data.v !== 1 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.expiresAt) ||
    !Number.isInteger(data.counters) ||
    data.counters < 1
  )
    return { ok: false, reason: "Licence key is damaged" };
  if (data.machine !== "*" && data.machine !== machine)
    return {
      ok: false,
      reason: "This licence key is for a different computer",
    };
  return { ok: true, data };
}
