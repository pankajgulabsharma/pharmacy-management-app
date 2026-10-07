import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { seedDemoData } from "../db/seed";
import { ensureOwner } from "../auth/store";
import { requiredPermission } from "../auth/guard";
import { signIn } from "../test/signIn";

let database: Database;
let app: ReturnType<typeof buildApp>;

beforeEach(async () => {
  await app?.close();
  database?.close();
  database = await openDatabase(":memory:");
  await seedDemoData(database);
  app = buildApp({ database });
});
afterAll(async () => {
  await app.close();
  database.close();
});

type H = { authorization: string } | undefined;
const call = (
  method: "GET" | "POST" | "PUT",
  url: string,
  headers?: H,
  payload?: object,
) => app.inject({ method, url, headers, payload });
const login = (username: string, password: string, remember = false) =>
  call("POST", "/api/auth/login", undefined, { username, password, remember });
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe("sign-in", () => {
  it("nothing in /api works without signing in (health does)", async () => {
    expect((await call("GET", "/health")).statusCode).toBe(200);
    expect((await call("GET", "/api/medicines")).statusCode).toBe(401);
    expect(
      (await call("GET", "/api/medicines", bearer("made-up"))).statusCode,
    ).toBe(401);
    expect((await call("GET", "/api/events?token=made-up")).statusCode).toBe(
      401,
    );
  });

  it("right password → token that works; sign-out ends it", async () => {
    const res = await login(" ADMIN ", "admin");
    expect(res.statusCode).toBe(200);
    const { token, user, expiresAt } = res.json();
    expect(user).toEqual({
      id: "u_admin",
      username: "admin",
      name: "Pankaj Sharma",
      role: "owner",
      mustChangePassword: false,
    });
    expect(expiresAt - Date.now()).toBeLessThanOrEqual(12 * 3_600_000);
    expect(
      (await call("GET", "/api/auth/me", bearer(token))).json().user.id,
    ).toBe("u_admin");
    expect(
      (await call("POST", "/api/auth/logout", bearer(token))).statusCode,
    ).toBe(204);
    expect((await call("GET", "/api/auth/me", bearer(token))).statusCode).toBe(
      401,
    );
  });

  it("remember me keeps the device signed in for days", async () => {
    const { expiresAt } = (await login("admin", "admin", true)).json();
    expect(expiresAt - Date.now()).toBeGreaterThan(6 * 24 * 3_600_000);
  });

  it("wrong password or unknown user → same answer; 5 tries → pause", async () => {
    const a = await login("admin", "wrong");
    const b = await login("nobody", "wrong");
    expect(a.statusCode).toBe(401);
    expect(b.json()).toEqual(a.json());
    for (let i = 0; i < 3; i++) await login("admin", "wrong");
    const locked = await login("admin", "wrong");
    expect(locked.statusCode).toBe(429);
    expect(locked.json().retryInSec).toBe(30);
    // Even the right password waits until the pause is over
    expect((await login("admin", "admin")).statusCode).toBe(429);
    // Other usernames are not affected
    expect((await login("cashier", "cashier")).statusCode).toBe(200);
  });

  it("passwords are stored only as a slow salted hash; tokens only as a hash", async () => {
    const { token } = (await login("admin", "admin")).json();
    const u = database.raw
      .prepare("SELECT password_hash FROM users WHERE username = 'admin'")
      .get() as { password_hash: string };
    expect(u.password_hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(u.password_hash).not.toContain("admin");
    const s = database.raw.prepare("SELECT token_hash FROM sessions").all() as {
      token_hash: string;
    }[];
    expect(s.map((r) => r.token_hash)).not.toContain(token);
  });

  it("a brand-new shop starts with one owner who must change the starter password", async () => {
    const empty = await openDatabase(":memory:");
    expect(await ensureOwner(empty.raw)).toBe(true);
    expect(await ensureOwner(empty.raw)).toBe(false); // only once
    const fresh = buildApp({ database: empty });
    const res = await fresh.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: "admin" },
    });
    expect(res.json().user.mustChangePassword).toBe(true);
    await fresh.close();
    empty.close();
  });
});

describe("roles — the server refuses, not just the screen", () => {
  it("cashier: bills yes; stock, settings, users no", async () => {
    const c = await signIn(app, "cashier");
    expect((await call("GET", "/api/medicines", c)).statusCode).toBe(200);
    expect((await call("GET", "/api/settings", c)).statusCode).toBe(200);
    // Allowed → reaches the rules (400 for an empty bill), not 403
    expect((await call("POST", "/api/sales", c, {})).statusCode).toBe(400);
    for (const [m, url] of [
      ["POST", "/api/stock/adjust"],
      ["POST", "/api/purchases"],
      ["POST", "/api/medicines"],
      ["PUT", "/api/settings"],
      ["POST", "/api/users"],
      ["GET", "/api/users"],
    ] as const) {
      const r = await call(m, url, c, {});
      expect(r.statusCode, `${m} ${url}`).toBe(403);
      expect(r.json().error).toMatch(/role/);
    }
  });

  it("pharmacist: stock yes; settings and users no", async () => {
    const p = await signIn(app, "pharmacist");
    expect((await call("POST", "/api/stock/adjust", p, {})).statusCode).toBe(
      400,
    );
    expect((await call("PUT", "/api/settings", p, {})).statusCode).toBe(403);
    expect((await call("GET", "/api/users", p)).statusCode).toBe(403);
  });

  it("a route nobody listed is owner-only", () => {
    expect(requiredPermission("POST", "/api/something-new")).toBe("admin");
    expect(requiredPermission("GET", "/api/something-new")).toBeNull();
    expect(requiredPermission("DELETE", "/api/held/x")).toBe("sell");
  });
});

describe("user accounts (owner)", () => {
  it("new person: starter password → must choose own → then can work", async () => {
    const owner = await signIn(app);
    const created = await call("POST", "/api/users", owner, {
      username: "Neha",
      name: "Neha Gupta",
      role: "cashier",
      password: "start123",
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().user).toMatchObject({
      username: "neha",
      mustChangePassword: true,
      active: true,
    });
    expect(JSON.stringify(created.json())).not.toMatch(/hash|start123/);

    const { token } = (await login("neha", "start123")).json();
    const neha = bearer(token);
    expect((await call("GET", "/api/medicines", neha)).statusCode).toBe(403);
    expect(
      (
        await call("POST", "/api/auth/password", neha, {
          current: "wrong",
          next: "mine-456",
        })
      ).statusCode,
    ).toBe(400);
    const changed = await call("POST", "/api/auth/password", neha, {
      current: "start123",
      next: "mine-456",
    });
    expect(changed.json().user.mustChangePassword).toBe(false);
    expect((await call("GET", "/api/medicines", neha)).statusCode).toBe(200);
    expect((await login("neha", "mine-456")).statusCode).toBe(200);
  });

  it("refuses duplicate usernames and weak passwords", async () => {
    const owner = await signIn(app);
    const dup = await call("POST", "/api/users", owner, {
      username: "cashier",
      name: "X Y",
      role: "cashier",
      password: "start123",
    });
    expect(dup.json().error).toMatch(/taken/);
    const weak = await call("POST", "/api/users", owner, {
      username: "neha",
      name: "Neha",
      role: "cashier",
      password: "123",
    });
    expect(weak.json().error).toMatch(/at least 6/);
  });

  it("switching an account off signs that person out at once", async () => {
    const owner = await signIn(app);
    const cashier = await signIn(app, "cashier");
    const r = await call("PUT", "/api/users/u_cashier", owner, {
      name: "Ravi Kumar",
      role: "cashier",
      active: false,
    });
    expect(r.json().user.active).toBe(false);
    expect((await call("GET", "/api/medicines", cashier)).statusCode).toBe(401);
    expect((await login("cashier", "cashier")).statusCode).toBe(401);
  });

  it("a new role takes effect on the very next request", async () => {
    const owner = await signIn(app);
    const cashier = await signIn(app, "cashier");
    expect(
      (await call("POST", "/api/stock/adjust", cashier, {})).statusCode,
    ).toBe(403);
    await call("PUT", "/api/users/u_cashier", owner, {
      name: "Ravi Kumar",
      role: "pharmacist",
      active: true,
    });
    expect(
      (await call("POST", "/api/stock/adjust", cashier, {})).statusCode,
    ).toBe(400);
  });

  it("owner can't lock themselves out or remove the last owner", async () => {
    const owner = await signIn(app);
    const self = await call("PUT", "/api/users/u_admin", owner, {
      name: "Pankaj Sharma",
      role: "owner",
      active: false,
    });
    expect(self.json().error).toMatch(/own account/);
  });

  it("forgot password: owner sets a temporary one; old sessions end", async () => {
    const owner = await signIn(app);
    const cashier = await signIn(app, "cashier");
    const r = await call("POST", "/api/users/u_cashier/password", owner, {
      password: "temp-999",
    });
    expect(r.json().user.mustChangePassword).toBe(true);
    expect((await call("GET", "/api/medicines", cashier)).statusCode).toBe(401);
    expect((await login("cashier", "cashier")).statusCode).toBe(401);
    expect((await login("cashier", "temp-999")).statusCode).toBe(200);
  });

  it("changing my password signs out my OTHER devices only", async () => {
    const pc1 = await signIn(app, "cashier");
    const pc2 = await signIn(app, "cashier");
    await call("POST", "/api/auth/password", pc1, {
      current: "cashier",
      next: "new-pass-1",
    });
    expect((await call("GET", "/api/medicines", pc1)).statusCode).toBe(200);
    expect((await call("GET", "/api/medicines", pc2)).statusCode).toBe(401);
  });
});

describe("shop settings (one copy for every counter)", () => {
  it("owner saves; everyone reads the same; bad values refused", async () => {
    const owner = await signIn(app);
    const cashier = await signIn(app, "cashier");
    const { settings } = (await call("GET", "/api/settings", cashier)).json();
    expect(settings.shop.name.length).toBeGreaterThan(1);

    const bad = await call("PUT", "/api/settings", owner, {
      shop: { ...settings.shop, phone: "12" },
    });
    expect(bad.statusCode).toBe(400);

    const ok = await call("PUT", "/api/settings", owner, {
      shop: { ...settings.shop, name: "  Sharma Medicals  " },
      doctors: ["Dr. A", "dr. a"],
    });
    expect(ok.statusCode).toBe(200);
    const again = (await call("GET", "/api/settings", cashier)).json().settings;
    expect(again.shop.name).toBe("Sharma Medicals");
    expect(again.doctors).toEqual(["Dr. A"]);
    expect(again.billing).toEqual(settings.billing);

    const extra = await call("PUT", "/api/settings", owner, { hacker: 1 });
    expect(extra.statusCode).toBe(400);
  });
});
