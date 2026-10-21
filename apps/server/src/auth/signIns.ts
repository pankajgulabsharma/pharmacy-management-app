/**
 * Sign-in history (Multi-counter plan): a row per sign-in — who, which
 * counter (the name set on that computer) and computer, how (PIN /
 * password), and when it ended. Rows close on sign-out, when a session
 * times out, or when the owner signs someone out. Kept for a year.
 */
import type { DatabaseSync } from "node:sqlite";
import type { FastifyRequest } from "fastify";
import { newId } from "@medicare/domain/lib/id";
import { hasFeature } from "@medicare/domain/license/plan";
import {
  SIGN_IN_KEEP_DAYS,
  type SignInMethod,
  type SignInRecord,
} from "@medicare/domain/auth/signIns";
import type { UserRecord } from "@medicare/domain/auth/types";
import { licenseState, type LicenseOptions } from "../license/state";
import { isLocal, sessionHash } from "./store";
import { lanAddresses } from "../routes/system";

/** The counter name this computer sends with every request ("" = not set) */
export function counterOf(req: FastifyRequest): string {
  const h = req.headers["x-counter"];
  const raw = Array.isArray(h) ? h[0] : h;
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim().replace(/\s+/g, " ").slice(0, 40);
  } catch {
    return "";
  }
}

/** "" = the main computer (this one), else its network address */
export function computerOf(ip: string): string {
  const a = ip.replace(/^::ffff:/, "");
  return isLocal(ip) || lanAddresses().includes(a) ? "" : a;
}

export const signInLogOn = (raw: DatabaseSync, license: LicenseOptions) =>
  hasFeature(licenseState(raw, license).plan, "signInLog");

export function recordSignIn(
  raw: DatabaseSync,
  license: LicenseOptions,
  req: FastifyRequest,
  user: Pick<UserRecord, "id" | "name" | "role">,
  token: string,
  method: SignInMethod,
  now = new Date(),
) {
  if (!signInLogOn(raw, license)) return;
  raw
    .prepare(
      "INSERT INTO sign_ins (id, session_hash, user_id, user_name, role, counter, computer, method, signed_in_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      newId("sin"),
      sessionHash(token),
      user.id,
      user.name,
      user.role,
      counterOf(req),
      computerOf(req.ip),
      method,
      now.toISOString(),
    );
  const cutoff = new Date(now.getTime() - SIGN_IN_KEEP_DAYS * 86_400_000);
  raw
    .prepare("DELETE FROM sign_ins WHERE signed_in_at < ?")
    .run(cutoff.toISOString());
}

type Row = {
  id: string;
  session_hash: string;
  user_id: string;
  user_name: string;
  role: string;
  counter: string;
  computer: string;
  method: SignInMethod;
  signed_in_at: string;
  signed_out_at: string | null;
  reason: SignInRecord["reason"];
};

/** Newest first, signed in between from and to (ISO) */
export function listSignIns(
  raw: DatabaseSync,
  from: string,
  to: string,
  now = Date.now(),
): (SignInRecord & { sessionHash: string })[] {
  // Sessions that ran out but were not cleaned up yet: they are over
  const gone = raw
    .prepare(
      `SELECT si.session_hash AS h, s.expires_at AS e FROM sign_ins si
       LEFT JOIN sessions s ON s.token_hash = si.session_hash
       WHERE si.signed_out_at IS NULL AND (s.token_hash IS NULL OR s.expires_at <= ?)`,
    )
    .all(now) as { h: string; e: number | null }[];
  for (const g of gone)
    raw
      .prepare(
        "UPDATE sign_ins SET signed_out_at = ?, reason = 'timed_out' WHERE session_hash = ? AND signed_out_at IS NULL",
      )
      .run(new Date(g.e ?? now).toISOString(), g.h);
  return (
    raw
      .prepare(
        "SELECT * FROM sign_ins WHERE signed_in_at >= ? AND signed_in_at < ? ORDER BY signed_in_at DESC LIMIT 2000",
      )
      .all(from, to) as Row[]
  ).map((r) => ({
    id: r.id,
    sessionHash: r.session_hash,
    userId: r.user_id,
    userName: r.user_name,
    role: r.role,
    counter: r.counter,
    computer: r.computer,
    method: r.method,
    signedInAt: r.signed_in_at,
    signedOutAt: r.signed_out_at,
    reason: r.reason,
  }));
}
