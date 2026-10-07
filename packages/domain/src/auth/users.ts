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
