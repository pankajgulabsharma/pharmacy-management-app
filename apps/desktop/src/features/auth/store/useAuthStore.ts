import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import { ROLES, type Role, type User } from "@medicare/domain/auth/types";
import { can, type Permission } from "@medicare/domain/auth/permissions";
import { ApiError, apiGet, apiRequest, setApiAuth } from "@/lib/api";
import { useNow } from "@/hooks/useNow";

/**
 * Who is signed in. The SERVER checks the password and issues a token;
 * the app only keeps that token (never the password) and sends it with
 * every call. Wrong-password pauses, expiry and roles are all decided by
 * the server — the app just hides what your role can't use.
 */
export type Session = {
  user: User;
  token: string;
  /** Epoch ms — the server ends the session here */
  expiresAt: number;
};

export type LoginResult =
  | { ok: true; user: User }
  | {
      ok: false;
      reason: "invalid" | "locked" | "offline";
      message: string;
      retryInSec?: number;
    };

type AuthState = {
  session: Session | null;
  /** "Remember me": keep the session after closing the app (until it expires) */
  remember: boolean;
  login: (
    username: string,
    password: string,
    remember: boolean,
  ) => Promise<LoginResult>;
  logout: () => Promise<void>;
  /** Re-read my name / role from the server (the owner may have changed it) */
  refreshMe: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
};

/** Longest a server session can last (remember me) — anything longer is not ours */
const MAX_SESSION_MS = 8 * 24 * 3_600_000;

/** Anything read back from storage is checked before it is trusted */
export function isValidSession(raw: unknown, now = Date.now()): raw is Session {
  if (!raw || typeof raw !== "object") return false;
  const s = raw as Partial<Session>;
  const u = s.user as Partial<User> | undefined;
  return (
    typeof s.token === "string" &&
    s.token.length > 20 &&
    typeof s.expiresAt === "number" &&
    s.expiresAt > now &&
    s.expiresAt <= now + MAX_SESSION_MS &&
    !!u &&
    typeof u.id === "string" &&
    typeof u.username === "string" &&
    typeof u.name === "string" &&
    typeof u.mustChangePassword === "boolean" &&
    ROLES.includes(u.role as Role)
  );
}

/**
 * Remembered sessions live in localStorage, others in sessionStorage
 * (gone when the app closes).
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

/** Server said "not signed in" (401) → back to the login screen */
const signedOut = () => {
  setApiAuth(null);
  useAuthStore.setState({ session: null, remember: false });
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      remember: false,

      login: async (username, password, remember) => {
        try {
          const r = await apiRequest<{
            token: string;
            expiresAt: number;
            user: User;
          }>("POST", "/api/auth/login", { username, password, remember });
          setApiAuth(r.token, signedOut);
          set({
            session: { user: r.user, token: r.token, expiresAt: r.expiresAt },
            remember,
          });
          return { ok: true, user: r.user };
        } catch (err) {
          const e = err as ApiError;
          if (e.kind !== "http")
            return {
              ok: false,
              reason: "offline",
              message: "Server not reachable — start the server and try again",
            };
          if (e.status === 429)
            return {
              ok: false,
              reason: "locked",
              message: e.message,
              retryInSec: Number(/(\d+) seconds/.exec(e.message)?.[1] ?? 30),
            };
          return { ok: false, reason: "invalid", message: e.message };
        }
      },

      logout: async () => {
        // Tell the server (ends the token there); sign out here even if it's offline
        if (get().session)
          await apiRequest("POST", "/api/auth/logout", {}, 3000).catch(
            () => {},
          );
        signedOut();
      },

      refreshMe: async () => {
        if (!get().session) return;
        const r = await apiGet<{ user: User; expiresAt: number }>(
          "/api/auth/me",
        );
        const s = get().session;
        if (s) set({ session: { ...s, user: r.user, expiresAt: r.expiresAt } });
      },

      changePassword: async (current, next) => {
        const r = await apiRequest<{ user: User }>(
          "POST",
          "/api/auth/password",
          { current, next },
        );
        const s = get().session;
        if (s) set({ session: { ...s, user: r.user } });
      },
    }),
    {
      name: "medicare-session",
      version: 2,
      // Sessions from the old demo sign-in (v1) are not valid on the server
      migrate: () => ({ session: null, remember: false }),
      // Outside a browser (tests) keep the session in memory — no storage warnings
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? splitStorage : memoryStorage(),
      ),
      partialize: (s) => ({ session: s.session, remember: s.remember }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AuthState>;
        const session = isValidSession(p.session) ? p.session : null;
        setApiAuth(session?.token ?? null, signedOut);
        return { ...current, session, remember: p.remember === true };
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

/** May the signed-in person do this? (hides buttons — the server enforces it) */
export function useCan(p: Permission): boolean {
  return useAuthStore((s) => can(s.session?.user.role, p));
}
