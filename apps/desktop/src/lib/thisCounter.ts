/**
 * Which counter THIS computer is ("Counter 2"). Chosen once in
 * Settings → This computer & network; kept on this computer only.
 * Sent with every request (X-Counter) so the server knows which counter's
 * galla a cash refund or udhaar payment belongs to and where a person
 * signed in. New bills on this computer start on this counter.
 */
const KEY = "medicare-this-counter";
let cached: string | null = null;

export function thisCounter(): string {
  if (cached !== null) return cached;
  try {
    cached = window.localStorage.getItem(KEY) ?? "";
  } catch {
    cached = "";
  }
  return cached;
}

export function setThisCounter(name: string) {
  cached = name.trim();
  try {
    if (cached) window.localStorage.setItem(KEY, cached);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — kept until the app is closed */
  }
  window.dispatchEvent(new Event("medicare:this-counter"));
}

/** This computer's counter if the shop still has it, else the default */
export const counterFor = (counters: readonly string[], fallback: string) => {
  const mine = thisCounter();
  return mine && counters.includes(mine) ? mine : fallback;
};
