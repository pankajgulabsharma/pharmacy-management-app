import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Passwords are stored only as a slow, salted scrypt hash
 * ("scrypt$N$r$p$salt$hash"). Slow on purpose: guessing millions of
 * passwords from a stolen database file would take years.
 */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 32;

function derive(password: string, salt: Buffer, n = N, r = R, p = P) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      KEY_LEN,
      { N: n, r, p, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/** Same work for a missing user, so timing doesn't reveal which usernames exist */
const DUMMY = `scrypt$${N}$${R}$${P}$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(KEY_LEN).toString("base64")}`;

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = (stored ?? DUMMY).split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await derive(
    password.slice(0, 200),
    Buffer.from(salt, "base64"),
    Number(n),
    Number(r),
    Number(p),
  );
  return (
    stored != null &&
    key.length === expected.length &&
    timingSafeEqual(key, expected)
  );
}
