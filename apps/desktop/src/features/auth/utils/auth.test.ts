import { beforeEach, describe, expect, it } from "vitest";
import { verifyCredentials } from "./credentials";
import {
  MAX_ATTEMPTS,
  isValidSession,
  useAuthStore,
} from "../store/useAuthStore";

const initial = useAuthStore.getState();
beforeEach(() => useAuthStore.setState(initial, true));

describe("demo sign-in", () => {
  it("accepts the demo accounts and rejects wrong passwords", async () => {
    expect((await verifyCredentials("admin", "admin"))?.role).toBe("owner");
    expect((await verifyCredentials("  ADMIN ", "admin"))?.name).toBe(
      "Pankaj Sharma",
    );
    expect(await verifyCredentials("admin", "Admin")).toBeNull();
    expect(await verifyCredentials("nobody", "admin")).toBeNull();
  });

  it("never exposes the password hash", async () => {
    const u = await verifyCredentials("cashier", "cashier");
    expect(Object.keys(u ?? {})).toEqual(["id", "username", "name", "role"]);
  });

  it("pauses sign-in after repeated wrong passwords", async () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      expect(
        (await useAuthStore.getState().login("admin", "x", false)).ok,
      ).toBe(false);
    }
    expect(
      await useAuthStore.getState().login("admin", "x", false),
    ).toMatchObject({ ok: false, reason: "locked" });
    // even the right password waits during the pause
    expect(
      await useAuthStore.getState().login("admin", "admin", false),
    ).toMatchObject({ reason: "locked" });
  });

  it("rejects expired or tampered sessions read back from storage", () => {
    const user = { id: "u", username: "a", name: "A", role: "owner" };
    expect(isValidSession({ user, expiresAt: Date.now() + 1000 })).toBe(true);
    expect(isValidSession({ user, expiresAt: Date.now() - 1 })).toBe(false);
    expect(
      isValidSession({
        user: { ...user, role: "superadmin" },
        expiresAt: Date.now() + 1000,
      }),
    ).toBe(false);
    expect(
      isValidSession({ user, expiresAt: Date.now() + 10 * 365 * 86_400_000 }),
    ).toBe(false);
  });
});
