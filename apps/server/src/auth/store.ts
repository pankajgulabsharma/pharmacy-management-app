/**
 * User accounts and signed-in sessions in the database.
 * A session token is random (256 bits); only its SHA-256 is stored.
 */
import { createHash, randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { newId } from "@medicare/domain/lib/id";
import type { Role, User, UserRecord } from "@medicare/domain/auth/types";
import { hashPassword } from "./password";

/** Signed in until… (remembered devices stay signed in longer) */
export const SESSION_HOURS = 12;
export const REMEMBER_DAYS = 7;

type UserRow = {
  id: string;
  username: string;
  name: string;
  role: Role;
  password_hash: string;
  active: number;
  must_change_password: number;
  created_at: string;
};

const toRecord = (r: UserRow): UserRecord => ({
  id: r.id,
  username: r.username,
  name: r.name,
  role: r.role,
  active: r.active === 1,
  mustChangePassword: r.must_change_password === 1,
  createdAt: r.created_at,
});

export const toUser = ({
  id,
  username,
  name,
  role,
  mustChangePassword,
}: UserRecord): User => ({
  id,
  username,
  name,
  role,
  mustChangePassword,
});

export function loadUsers(raw: DatabaseSync): UserRecord[] {
  return (
    raw
      .prepare("SELECT * FROM users ORDER BY created_at, username")
      .all() as UserRow[]
  ).map(toRecord);
}

export function findUser(
  raw: DatabaseSync,
  where: "id" | "username",
  value: string,
) {
  const row = raw
    .prepare(`SELECT * FROM users WHERE ${where} = ?`)
    .get(value) as UserRow | undefined;
  return row ? { user: toRecord(row), passwordHash: row.password_hash } : null;
}

export async function createUser(
  raw: DatabaseSync,
  u: { username: string; name: string; role: Role; password: string },
  opts: { mustChangePassword?: boolean; now?: Date } = {},
): Promise<UserRecord> {
  const hash = await hashPassword(u.password);
  const id = newId("usr");
  raw
    .prepare(
      "INSERT INTO users (id, username, name, role, password_hash, active, must_change_password, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
    )
    .run(
      id,
      u.username,
      u.name,
      u.role,
      hash,
      opts.mustChangePassword ? 1 : 0,
      (opts.now ?? new Date()).toISOString(),
    );
  return findUser(raw, "id", id)!.user;
}

export async function setPassword(
  raw: DatabaseSync,
  userId: string,
  password: string,
  mustChange: boolean,
) {
  const hash = await hashPassword(password);
  raw
    .prepare(
      "UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?",
    )
    .run(hash, mustChange ? 1 : 0, userId);
}

const sha = (token: string) => createHash("sha256").update(token).digest("hex");

export function createSession(
  raw: DatabaseSync,
  userId: string,
  remember: boolean,
  ip = "",
  now = Date.now(),
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt =
    now + (remember ? REMEMBER_DAYS * 24 : SESSION_HOURS) * 3_600_000;
  // Old, expired sessions are cleaned up on every sign-in
  raw.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  raw
    .prepare(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip) VALUES (?, ?, ?, ?, ?)",
    )
    .run(sha(token), userId, new Date(now).toISOString(), expiresAt, ip);
  return { token, expiresAt };
}

/** The signed-in user for a token — null if unknown, expired or switched off */
export function resolveSession(
  raw: DatabaseSync,
  token: string,
  now = Date.now(),
) {
  if (!token || token.length > 100) return null;
  const row = raw
    .prepare(
      `SELECT u.*, s.expires_at AS session_expires_at FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`,
    )
    .get(sha(token), now) as
    (UserRow & { session_expires_at: number }) | undefined;
  return row
    ? { user: toRecord(row), expiresAt: row.session_expires_at }
    : null;
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", ""]);
export const isLocal = (ip: string) => LOOPBACK.has(ip);

/** Other computers (not this one) signed in right now */
export function activeCounterIps(
  raw: DatabaseSync,
  now = Date.now(),
): Set<string> {
  const rows = raw
    .prepare("SELECT DISTINCT ip FROM sessions WHERE expires_at > ?")
    .all(now) as { ip: string }[];
  return new Set(rows.map((r) => r.ip).filter((ip) => !isLocal(ip)));
}

export function endSession(raw: DatabaseSync, token: string) {
  raw.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
}

/** Sign a person out everywhere (password reset, account switched off) — optionally keep one device */
export function endUserSessions(
  raw: DatabaseSync,
  userId: string,
  keepToken?: string,
) {
  raw
    .prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?")
    .run(userId, keepToken ? sha(keepToken) : "");
}

/**
 * Brand-new shop with no accounts → create the owner "admin" with the
 * starter password "admin", which must be changed at the first sign-in.
 */
export async function ensureOwner(raw: DatabaseSync): Promise<boolean> {
  const { n } = raw.prepare("SELECT count(*) n FROM users").get() as {
    n: number;
  };
  if (n > 0) return false;
  await createUser(
    raw,
    { username: "admin", name: "Owner", role: "owner", password: "admin" },
    { mustChangePassword: true },
  );
  return true;
}
