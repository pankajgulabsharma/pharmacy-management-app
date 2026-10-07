import { describe, expect, it } from "vitest";
import { can } from "./permissions";
import { checkPassword, cleanNewUser, cleanUserUpdate } from "./users";
import type { UserRecord } from "./types";

const user = (p: Partial<UserRecord>): UserRecord => ({
  id: "u1",
  username: "admin",
  name: "Admin",
  role: "owner",
  active: true,
  mustChangePassword: false,
  createdAt: "",
  ...p,
});

describe("roles", () => {
  it("cashier sells only; pharmacist also stock + reports; owner everything", () => {
    expect(can("cashier", "sell")).toBe(true);
    expect(can("cashier", "stock")).toBe(false);
    expect(can("cashier", "reports")).toBe(false);
    expect(can("pharmacist", "stock")).toBe(true);
    expect(can("pharmacist", "admin")).toBe(false);
    expect(can("owner", "admin")).toBe(true);
    expect(can(null, "sell")).toBe(false);
  });
});

describe("user accounts", () => {
  it("checks username, name, role and password", () => {
    const ok = cleanNewUser(
      {
        username: " Ravi.K ",
        name: " Ravi ",
        role: "cashier",
        password: "secret1",
      },
      [],
    );
    expect(ok).toMatchObject({ username: "ravi.k", name: "Ravi" });
    expect(() =>
      cleanNewUser(
        { username: "ab", name: "X Y", role: "cashier", password: "secret1" },
        [],
      ),
    ).toThrow(/Username/);
    expect(() =>
      cleanNewUser(
        {
          username: "admin",
          name: "X Y",
          role: "cashier",
          password: "secret1",
        },
        [user({})],
      ),
    ).toThrow(/taken/);
    expect(() =>
      cleanNewUser(
        {
          username: "ravi",
          name: "Ravi",
          role: "boss" as never,
          password: "secret1",
        },
        [],
      ),
    ).toThrow(/role/);
    expect(checkPassword("12345")).toMatch(/at least 6/);
    expect(checkPassword("ravi12", "RAVI12")).toMatch(/same as the username/);
    expect(checkPassword("good-one")).toBeNull();
  });

  it("always keeps one active owner and never locks yourself out", () => {
    const owner = user({});
    const cashier = user({ id: "u2", username: "c", role: "cashier" });
    const all = [owner, cashier];
    // The only owner can't be demoted or switched off by someone else
    expect(() =>
      cleanUserUpdate(
        owner,
        { name: "Admin", role: "cashier", active: true },
        all,
        "u9",
      ),
    ).toThrow(/at least one active owner/);
    // Nor switch themselves off / change their own role
    expect(() =>
      cleanUserUpdate(
        owner,
        { name: "Admin", role: "owner", active: false },
        all,
        "u1",
      ),
    ).toThrow(/own account/);
    expect(() =>
      cleanUserUpdate(
        owner,
        { name: "Admin", role: "pharmacist", active: true },
        all,
        "u1",
      ),
    ).toThrow(/own role/);
    // A second owner makes it possible
    const owner2 = user({ id: "u3", username: "o2" });
    expect(
      cleanUserUpdate(
        owner,
        { name: "Admin", role: "cashier", active: true },
        [...all, owner2],
        "u3",
      ),
    ).toMatchObject({ role: "cashier" });
    // Other users: fine
    expect(
      cleanUserUpdate(
        cashier,
        { name: "Cash Ier", role: "pharmacist", active: false },
        all,
        "u1",
      ),
    ).toEqual({ name: "Cash Ier", role: "pharmacist", active: false });
  });
});
