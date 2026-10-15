import { describe, expect, it } from "vitest";
import type { Sale } from "../billing/types";
import type { Customer } from "./types";
import { refillMessage, refillsDue } from "./refills";

const NOW = new Date("2026-10-15T12:00:00Z");
const ago = (d: number) =>
  new Date(NOW.getTime() - d * 86_400_000).toISOString();

const cust = (id: string, over: Partial<Customer> = {}) =>
  ({
    id,
    name: `Cust ${id}`,
    phone: "9820000000",
    status: "active",
    ...over,
  }) as Customer;

let n = 0;
const bill = (customerId: string | null, daysAgo: number, ...meds: string[]) =>
  ({
    id: `s${++n}`,
    customerId,
    createdAt: ago(daysAgo),
    lines: meds.map((m) => ({ medicineId: m, medicineName: `Med ${m}` })),
  }) as unknown as Sale;

describe("refill reminders", () => {
  const customers = [
    cust("a"),
    cust("b"),
    cust("c"),
    cust("off", { status: "inactive" }),
  ];

  it("monthly buyer: due after the usual gap", () => {
    const r = refillsDue(
      [
        bill("a", 88, "telma"),
        bill("a", 58, "telma", "dolo"),
        bill("a", 28, "telma"), // every 30 days
        bill("a", 26, "telma"), // a repeat bill 2 days later is not a new cycle → due in 4 days
      ],
      customers,
      {},
      NOW,
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      customerId: "a",
      medicineId: "telma",
      everyDays: 30,
      daysLeft: 4,
      times: 4,
    });
  });

  it("bought once, not a regular, walk-in or inactive → no reminder", () => {
    const r = refillsDue(
      [
        bill("b", 20, "azee"), // once
        bill(null, 60, "x"),
        bill(null, 30, "x"), // walk-in (no customer)
        bill("off", 60, "y"),
        bill("off", 30, "y"), // inactive customer
      ],
      customers,
      {},
      NOW,
    );
    expect(r).toEqual([]);
  });

  it("overdue first; stopped long ago is dropped", () => {
    const r = refillsDue(
      [
        bill("c", 50, "m1"),
        bill("c", 40, "m1"), // every 10 → 30 days late: stopped
        bill("b", 70, "m2"),
        bill("b", 40, "m2"), // every 30 → 10 days late
        bill("a", 33, "m3"),
        bill("a", 3, "m3"), // every 30 → due in 27 days: not yet
      ],
      customers,
      {},
      NOW,
    );
    expect(r.map((x) => [x.customerId, x.daysLeft])).toEqual([["b", -10]]);
  });

  it("one WhatsApp message per customer", () => {
    const text = refillMessage("Ramesh", ["Telma 40", "Glycomet 500"], {
      name: "Shree Sai",
      phone: "02225401234",
    });
    expect(text).toContain("🙏 Namaste *Ramesh* ji,");
    expect(text).toContain("   ▪️ *Telma 40*\n   ▪️ *Glycomet 500*");
    expect(text).toContain("✅ *Shree Sai* par available hai.");
    expect(text.endsWith("📞 02225401234")).toBe(true);
  });
});
