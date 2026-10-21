/**
 * Sign-in history (Multi-counter plan): who signed in, on which counter
 * and computer, when — and when and how they left. Kept for a year.
 */
export type SignInMethod = "pin" | "password" | "setup";
/** "" = still signed in */
export type SignOutReason = "" | "signed_out" | "timed_out" | "removed";

export const SIGN_OUT_LABEL: Record<Exclude<SignOutReason, "">, string> = {
  signed_out: "Signed out",
  timed_out: "Timed out",
  removed: "Signed out by owner",
};

export type SignInRecord = {
  id: string;
  userId: string;
  userName: string;
  role: string;
  /** Counter name set on that computer ("" = not set) */
  counter: string;
  /** "" = the main computer, else its network address */
  computer: string;
  method: SignInMethod;
  signedInAt: string;
  signedOutAt: string | null;
  reason: SignOutReason;
  /** Still signed in AND the app is open on that computer right now */
  appOpen?: boolean;
};

/** Days of history kept */
export const SIGN_IN_KEEP_DAYS = 366;

/** Minutes between sign-in and sign-out (or now, while still signed in) */
export function minutesOn(r: SignInRecord, now = Date.now()): number {
  const end = r.signedOutAt ? Date.parse(r.signedOutAt) : now;
  return Math.max(0, Math.round((end - Date.parse(r.signedInAt)) / 60_000));
}

/** 135 → "2 h 15 min" */
export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
