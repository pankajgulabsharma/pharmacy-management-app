import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "@/lib/api";
import { isValidSession, useAuthStore } from "../store/useAuthStore";

const initial = useAuthStore.getState();
beforeEach(() => useAuthStore.setState(initial, true));
afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const user = {
  id: "u_admin",
  username: "admin",
  name: "Pankaj Sharma",
  role: "owner",
  mustChangePassword: false,
} as const;
const TOKEN = "x".repeat(43);

/** Server stand-in: answers by path; records what the app sent */
function server(answer: (path: string) => Promise<Response>) {
  const sent: { path: string; auth: string | null; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      sent.push({
        path,
        auth: new Headers(init?.headers).get("Authorization"),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return answer(path);
    }),
  );
  return sent;
}

describe("sign-in through the server", () => {
  it("right password → signed in; every later call carries the token", async () => {
    const sent = server((p) =>
      p === "/api/auth/login"
        ? json({ token: TOKEN, expiresAt: Date.now() + 3_600_000, user })
        : json({ items: [] }),
    );
    const r = await useAuthStore.getState().login("admin", "admin", true);
    expect(r).toEqual({ ok: true, user });
    expect(sent[0].body).toEqual({
      username: "admin",
      password: "admin",
      remember: true,
    });
    expect(useAuthStore.getState().session?.token).toBe(TOKEN);
    await apiGet("/api/medicines");
    expect(sent[1].auth).toBe(`Bearer ${TOKEN}`);
  });

  it("wrong password / paused / server off → clear reasons", async () => {
    server(() => json({ error: "Wrong username or password" }, 401));
    expect(
      await useAuthStore.getState().login("admin", "x", false),
    ).toMatchObject({ ok: false, reason: "invalid" });

    server(() =>
      json(
        {
          error: "Too many wrong attempts — try again in 27 seconds",
          retryInSec: 27,
        },
        429,
      ),
    );
    expect(
      await useAuthStore.getState().login("admin", "x", false),
    ).toMatchObject({ ok: false, reason: "locked", retryInSec: 27 });

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    expect(
      await useAuthStore.getState().login("admin", "admin", false),
    ).toMatchObject({ ok: false, reason: "offline" });
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("server says 401 later (signed out elsewhere) → back to login", async () => {
    server((p) =>
      p === "/api/auth/login"
        ? json({ token: TOKEN, expiresAt: Date.now() + 3_600_000, user })
        : json({ error: "Please sign in again" }, 401),
    );
    await useAuthStore.getState().login("admin", "admin", false);
    await expect(apiGet("/api/medicines")).rejects.toThrow(/sign in/);
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("sign-out ends the session on the server too", async () => {
    const sent = server((p) =>
      p === "/api/auth/login"
        ? json({ token: TOKEN, expiresAt: Date.now() + 3_600_000, user })
        : Promise.resolve(new Response(null, { status: 204 })),
    );
    await useAuthStore.getState().login("admin", "admin", false);
    await useAuthStore.getState().logout();
    expect(sent.at(-1)).toMatchObject({
      path: "/api/auth/logout",
      auth: `Bearer ${TOKEN}`,
    });
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("a new role from the owner shows up without signing in again", async () => {
    server((p) =>
      p === "/api/auth/login"
        ? json({ token: TOKEN, expiresAt: Date.now() + 3_600_000, user })
        : json({
            user: { ...user, role: "cashier" },
            expiresAt: Date.now() + 3_600_000,
          }),
    );
    await useAuthStore.getState().login("admin", "admin", false);
    await useAuthStore.getState().refreshMe();
    expect(useAuthStore.getState().session?.user.role).toBe("cashier");
  });

  it("rejects expired or tampered sessions read back from storage", () => {
    const ok = { user, token: TOKEN, expiresAt: Date.now() + 1000 };
    expect(isValidSession(ok)).toBe(true);
    expect(isValidSession({ ...ok, expiresAt: Date.now() - 1 })).toBe(false);
    expect(isValidSession({ ...ok, token: "" })).toBe(false);
    expect(
      isValidSession({ ...ok, user: { ...user, role: "superadmin" } }),
    ).toBe(false);
    expect(
      isValidSession({ ...ok, expiresAt: Date.now() + 365 * 86_400_000 }),
    ).toBe(false);
  });
});
