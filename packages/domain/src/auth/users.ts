import { RuleError } from "../lib/errors";
import { cleanText } from "../lib/sanitize";
import {
  ROLES,
  type Role,
  type UserInput,
  type UserRecord,
  type UserUpdate,
} from "./types";

export const USER_LIMITS = {
  usernameMax: 30,
  nameMax: 60,
  passwordMin: 6,
  passwordMax: 200,
} as const;

/**
 * Anyone may sign in at the counter with a 4-digit PIN. The owner sets the
 * staff's PINs; an owner's PIN is set only by that owner (with their
 * password) — never by someone else.
 */
export const PIN_LENGTH = 4;
export const ownerSetsPin = (role: Role) => role !== "owner";

/** Returns a message, or null when the PIN is acceptable */
export function checkPin(pin: string): string | null {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin))
    return `PIN must be ${PIN_LENGTH} digits`;
  return null; // any 4 digits — the shop chooses
}

/** "Ravi Kumar Sharma" → "RS", "ravi" → "RA" */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Owner's recovery code: 12 letters/digits in 3 groups ("K7QM-3XHP-9TDA"),
 * no look-alikes (0/O, 1/I/L). Typed back in any case, with or without dashes.
 */
export const RECOVERY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const cleanRecoveryCode = (code: string) =>
  code.toUpperCase().replace(/[^0-9A-Z]/g, "");
export function formatRecoveryCode(raw: string) {
  const c = cleanRecoveryCode(raw);
  return [c.slice(0, 4), c.slice(4, 8), c.slice(8, 12)]
    .filter(Boolean)
    .join("-");
}

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** "  Ravi.K " → "ravi.k" (sign-in names are case-insensitive) */
export const normalizeUsername = (u: string) => u.trim().toLowerCase();

/** Returns a message, or null when the password is acceptable */
export function checkPassword(password: string, username = ""): string | null {
  if (password.length < USER_LIMITS.passwordMin)
    return `Password must be at least ${USER_LIMITS.passwordMin} characters`;
  if (password.length > USER_LIMITS.passwordMax) return "Password is too long";
  if (username && password.toLowerCase() === username.toLowerCase())
    return "Password can't be the same as the username";
  return null;
}

function cleanRole(role: unknown): Role {
  if (!ROLES.includes(role as Role)) throw new RuleError("Choose a role");
  return role as Role;
}

function cleanName(name: string): string {
  const n = cleanText(name, USER_LIMITS.nameMax);
  if (n.length < 2) throw new RuleError("Name is required");
  return n;
}

/** New account: checks every field; username must be unused */
export function cleanNewUser(
  input: UserInput,
  others: readonly UserRecord[],
): UserInput {
  const username = normalizeUsername(input.username);
  if (!USERNAME_RE.test(username))
    throw new RuleError(
      "Username: 3–30 characters — letters, digits, dot, dash or underscore",
    );
  if (others.some((u) => u.username === username))
    throw new RuleError("This username is already taken");
  const bad = checkPassword(input.password, username);
  if (bad) throw new RuleError(bad);
  return {
    username,
    name: cleanName(input.name),
    role: cleanRole(input.role),
    password: input.password,
  };
}

/**
 * Edit an account. The shop must always keep at least one active owner,
 * and nobody can switch off their own account (no accidental lock-out).
 */
export function cleanUserUpdate(
  current: UserRecord,
  input: UserUpdate,
  all: readonly UserRecord[],
  actingUserId: string,
): UserUpdate {
  const next: UserUpdate = {
    name: cleanName(input.name),
    role: cleanRole(input.role),
    active: input.active === true,
  };
  if (current.id === actingUserId && !next.active)
    throw new RuleError("You can't switch off your own account");
  if (current.id === actingUserId && next.role !== current.role)
    throw new RuleError("You can't change your own role");
  const stillOwner = next.active && next.role === "owner";
  if (current.role === "owner" && current.active && !stillOwner) {
    const otherOwners = all.filter(
      (u) => u.id !== current.id && u.active && u.role === "owner",
    );
    if (otherOwners.length === 0)
      throw new RuleError("The shop needs at least one active owner");
  }
  return next;
}
