import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import type { Role, Session, User } from "../types";
import { verifyCredentials } from "../utils/credentials";
import { useNow } from "@/hooks/useNow";

/** Sessions end after this long, even if the app stays open */
export const SESSION_HOURS = 12;
/** After this many wrong tries, sign-in pauses briefly (slows guessing) */
export const MAX_ATTEMPTS = 5;
export const LOCK_SECONDS = 30;

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" | "locked"; retryInSec?: number };

type AuthState = {
  session: Session | null;
  /** "Remember me": keep the session after closing the app (until it expires) */
  remember: boolean;
  failedAttempts: number;
  lockedUntil: number;
  login: (
    username: string,
    password: string,
    remember: boolean,
  ) => Promise<LoginResult>;
  logout: () => void;
};

const ROLES: readonly Role[] = ["owner", "pharmacist", "cashier"];

/** Anything read back from storage is checked before it is trusted */
export function isValidSession(raw: unknown, now = Date.now()): raw is Session {
  if (!raw || typeof raw !== "object") return false;
  const s = raw as Partial<Session>;
  const u = s.user as Partial<User> | undefined;
  return (
    typeof s.expiresAt === "number" &&
    s.expiresAt > now &&
    s.expiresAt <= now + SESSION_HOURS * 3_600_000 &&
    !!u &&
    typeof u.id === "string" &&
    typeof u.username === "string" &&
    typeof u.name === "string" &&
    ROLES.includes(u.role as Role)
  );
}

/**
 * Remembered sessions live in localStorage, others in sessionStorage
 * (gone when the app closes). TODO(api): the server issues the session.
 */
const splitStorage: StateStorage = {
  getItem: (k) => {
    try {
      return window.sessionStorage.getItem(k) ?? window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      const remember =
        (JSON.parse(v) as { state?: { remember?: boolean } }).state
          ?.remember === true;
      (remember ? window.localStorage : window.sessionStorage).setItem(k, v);
      (remember ? window.sessionStorage : window.localStorage).removeItem(k);
    } catch {
      /* storage unavailable — signed in only until reload */
    }
  },
  removeItem: (k) => {
    try {
      window.localStorage.removeItem(k);
      window.sessionStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

/** In-memory storage for tests / non-browser runs */
function memoryStorage(): StateStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      remember: false,
      failedAttempts: 0,
      lockedUntil: 0,

      login: async (username, password, remember) => {
        const now = Date.now();
        if (get().lockedUntil > now) {
          return {
            ok: false,
            reason: "locked",
            retryInSec: Math.ceil((get().lockedUntil - now) / 1000),
          };
        }
        const user = await verifyCredentials(username, password);
        if (!user) {
          const failed = get().failedAttempts + 1;
          const lock = failed >= MAX_ATTEMPTS;
          set({
            failedAttempts: lock ? 0 : failed,
            lockedUntil: lock ? Date.now() + LOCK_SECONDS * 1000 : 0,
          });
          return lock
            ? { ok: false, reason: "locked", retryInSec: LOCK_SECONDS }
            : { ok: false, reason: "invalid" };
        }
        set({
          session: { user, expiresAt: Date.now() + SESSION_HOURS * 3_600_000 },
          remember,
          failedAttempts: 0,
          lockedUntil: 0,
        });
        return { ok: true, user };
      },

      logout: () => set({ session: null, remember: false }),
    }),
    {
      name: "medicare-session",
      version: 1,
      // Outside a browser (tests) keep the session in memory — no storage warnings
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? splitStorage : memoryStorage(),
      ),
      partialize: (s) => ({ session: s.session, remember: s.remember }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AuthState>;
        return {
          ...current,
          session: isValidSession(p.session) ? p.session : null,
          remember: p.remember === true,
        };
      },
    },
  ),
);

/**
 * Current user, or null when signed out or expired. Re-checks every minute,
 * so an expired session signs out even if the app is left open.
 */
export function useCurrentUser(): User | null {
  const session = useAuthStore((s) => s.session);
  const now = useNow();
  return session && session.expiresAt > now ? session.user : null;
}
