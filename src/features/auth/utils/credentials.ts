/**
 * DEMO sign-in, kept behind ONE function so the backend can replace it:
 * verifyCredentials() becomes a call to POST /auth/login.
 *
 * Passwords are never stored in plain text, even in the demo — only a
 * salted SHA-256. (The real server will use a slow hash such as Argon2.)
 */
import type { User } from "../types";

type Account = User & { salt: string; hash: string };

/** Demo accounts: admin / admin (owner), cashier / cashier (cashier) */
const ACCOUNTS: readonly Account[] = [
  {
    id: "u_admin",
    username: "admin",
    name: "Pankaj Sharma",
    role: "owner",
    salt: "mc-demo-1",
    hash: "9969ca30e48ca9b68fa949fe6064b159a15f6c393c84de2838f00f98264bde04",
  },
  {
    id: "u_cashier",
    username: "cashier",
    name: "Ravi Kumar",
    role: "cashier",
    salt: "mc-demo-2",
    hash: "883a4204bf3a6204c8664a45a004ca11aaabc8f50d541a6e2775ba85591e2c20",
  },
];

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time compare, so timing doesn't reveal how much matched */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns the user, or null for a wrong username OR password (never says which) */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<User | null> {
  const name = username.trim().toLowerCase().slice(0, 60);
  const account = ACCOUNTS.find((a) => a.username === name);
  // Hash even when the user doesn't exist, so both cases take the same time
  const hash = await sha256Hex(
    `${account?.salt ?? "none"}:${password.slice(0, 200)}`,
  );
  if (!account || !safeEqual(hash, account.hash)) return null;
  return {
    id: account.id,
    username: account.username,
    name: account.name,
    role: account.role,
  };
}
