/**
 * Slows down password guessing: after 5 wrong tries for one username from
 * one computer, sign-in for it pauses for 30 seconds. (In memory — a
 * server restart clears it, which is fine for a shop.)
 */
export class LoginLimiter {
  private tries = new Map<string, { fails: number; lockedUntil: number }>();
  constructor(
    readonly maxAttempts = 5,
    readonly lockMs = 30_000,
  ) {}

  /** Seconds left if locked, else 0 */
  lockedFor(key: string, now = Date.now()): number {
    const t = this.tries.get(key);
    return t && t.lockedUntil > now
      ? Math.ceil((t.lockedUntil - now) / 1000)
      : 0;
  }

  /** Returns seconds locked (0 = not yet) */
  fail(key: string, now = Date.now()): number {
    const t = this.tries.get(key) ?? { fails: 0, lockedUntil: 0 };
    t.fails += 1;
    if (t.fails >= this.maxAttempts) {
      t.fails = 0;
      t.lockedUntil = now + this.lockMs;
    }
    this.tries.set(key, t);
    if (this.tries.size > 10_000) this.tries.clear(); // never grows without limit
    return this.lockedFor(key, now);
  }

  success(key: string) {
    this.tries.delete(key);
  }
}
