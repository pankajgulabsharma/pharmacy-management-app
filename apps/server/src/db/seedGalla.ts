/**
 * Demo: the last six days of the galla (opened, a few expenses, counted
 * and closed — one day ₹50 short, one ₹20 excess) and a week of sign-ins,
 * so Reports → Galla and Users → Sign-in history have something to show.
 */
import type { DatabaseSync } from "node:sqlite";
import { businessDate } from "@medicare/domain/cash/galla";
import { newId } from "@medicare/domain/lib/id";
import * as g from "../shop/galla";

const DEV = { enforce: false, publicKey: "", machine: "" };
const at = (date: string, h: number, m = 0) => {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m);
};

export function seedDemoGalla(raw: DatabaseSync) {
  const counter = g.perCounter(raw, DEV) ? (g.shopCounters(raw)[0] ?? "") : "";
  const diffs = [0, -50_00, 0, 20_00, 0, 0];
  const teas = [60_00, 0, 80_00, 45_00, 0, 70_00];
  for (let i = 6; i >= 1; i--) {
    const date = businessDate(new Date(Date.now() - i * 86_400_000));
    const k = 6 - i;
    g.openDay(
      raw,
      date,
      counter,
      g.suggestedOpening(raw, date, counter) || 2000_00,
      "",
      "Ravi Kumar",
    );
    raw
      .prepare(
        "UPDATE cash_days SET opened_at = ? WHERE date = ? AND counter = ?",
      )
      .run(at(date, 9, 5).toISOString(), date, counter);
    if (teas[k])
      g.addEntry(raw, {
        date,
        at: at(date, 16, 30),
        counter,
        kind: "out",
        category: "Shop expense",
        amountPaise: teas[k],
        note: "Tea & snacks",
        by: "Ravi Kumar",
        source: "manual",
        ref: "",
      });
    const expected = g.gallaView(raw, DEV, date, counter).summary.expectedPaise;
    const counted = Math.max(0, expected + diffs[k]);
    g.closeDay(
      raw,
      DEV,
      {
        date,
        counter,
        countedPaise: counted,
        keptPaise: Math.min(2000_00, counted),
        denominations: {},
        note:
          diffs[k] < 0
            ? "₹50 change given extra by mistake"
            : diffs[k] > 0
              ? "Customer left change"
              : "",
      },
      i % 2 ? "Ravi Kumar" : "Anita Verma",
    );
    raw
      .prepare(
        "UPDATE cash_days SET closed_at = ? WHERE date = ? AND counter = ?",
      )
      .run(at(date, 21, 10).toISOString(), date, counter);

    // Sign-ins of that day (past sessions — all ended)
    const rows: [
      string,
      string,
      string,
      string,
      string,
      number,
      number,
      number,
      number,
    ][] = [
      ["u_cashier", "Ravi Kumar", "cashier", "Counter 1", "pin", 9, 2, 14, 0],
      [
        "u_cashier",
        "Ravi Kumar",
        "cashier",
        "Counter 1",
        "pin",
        14,
        40,
        21,
        15,
      ],
      [
        "u_pharmacist",
        "Anita Verma",
        "pharmacist",
        "Counter 2",
        "password",
        10,
        15,
        19,
        30,
      ],
      ["u_admin", "Pankaj Sharma", "owner", "", "password", 20, 45, 21, 20],
    ];
    for (const [uid, name, role, ctr, method, h1, m1, h2, m2] of rows)
      raw
        .prepare(
          "INSERT INTO sign_ins (id, user_id, user_name, role, counter, computer, method, signed_in_at, signed_out_at, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          newId("sin"),
          uid,
          name,
          role,
          ctr,
          ctr === "Counter 2" ? "192.168.1.12" : "",
          method,
          at(date, h1, m1).toISOString(),
          at(date, h2, m2).toISOString(),
          h2 === 14
            ? "signed_out"
            : role === "owner"
              ? "signed_out"
              : "timed_out",
        );
  }
}
