/**
 * Collision-safe IDs. Uses crypto.randomUUID() (available on https and
 * localhost) instead of Math.random(), with a fallback for older contexts.
 */
export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}
