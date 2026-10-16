import { describe, expect, it } from "vitest";
import type { Sale } from "../billing/types";
import type { StockBatch } from "../inventory/types";
import {
  cleanRates,
  commissionReport,
  type CommissionPayout,
} from "./commission";

const range = {
  from: new Date(2026, 9, 1),
  to: new Date(2026, 9, 31, 23, 59, 59),
};
let n = 0;
const bill = (
  doctor: string,
  billedBy: string,
  netRupees: number,
  over: Partial<Sale> = {},
) =>
  ({
    id: `s${++n}`,
    createdAt: new Date(2026, 9, 10).toISOString(),
    doctor,
    billedBy,
    returnedPaise: 0,
    totals: { netPaise: netRupees * 100 },
    lines: [
      {
        amountPaise: netRupees * 100,
        unitsPerStrip: 10,
        allocations: [{ batchId: "b1", qtyStrip: 1, qtyLoose: 0 }],
      },
    ],
    ...over,
  }) as unknown as Sale;
// every bill: one strip that cost ₹60
const batches = [{ id: "b1", purchasePrice: 60 } as StockBatch];

describe("doctor referrals & staff commission", () => {
  const sales = [
    bill("Dr. Kavita Shah", "Ravi Kumar", 100),
    bill("dr. kavita  shah ", "Ravi Kumar", 200),
    bill("Dr. Mehta", "Anita Verma", 100, { returnedPaise: 5000 }), // half returned
    bill("", "Ravi Kumar", 100), // no doctor
    bill("Dr. Old", "Ravi Kumar", 100, {
      createdAt: new Date(2026, 8, 30).toISOString(),
    }), // last month
  ];

  it("% of sales: same doctor however typed; returns taken off", () => {
    const rates = cleanRates({
      basis: "sales",
      doctors: { "DR. KAVITA SHAH": 10 },
      staff: { "Ravi Kumar": 1 },
    });
    const r = commissionReport(sales, batches, rates, range);
    expect(
      r.doctors.map((x) => [x.name, x.bills, x.salesPaise, x.commissionPaise]),
    ).toEqual([
      ["Dr. Kavita Shah", 2, 300_00, 30_00],
      ["Dr. Mehta", 1, 50_00, 0], // no rate → still listed (doctor-wise sales)
    ]);
    expect(r.staff[0]).toMatchObject({
      name: "Ravi Kumar",
      bills: 3,
      salesPaise: 400_00,
      commissionPaise: 4_00,
    });
    expect(r.totalDuePaise).toBe(34_00);
  });

  it("% of profit, and payouts recorded for the period", () => {
    const rates = cleanRates({
      basis: "profit",
      doctors: { "Dr. Kavita Shah": 20 },
    });
    const paid: CommissionPayout[] = [
      {
        id: "p1",
        kind: "doctor",
        name: "dr kavita shah".replace("dr", "Dr."),
        from: "2026-10-01",
        to: "2026-10-31",
        amountPaise: 10_00,
        paidAt: "",
        note: "",
      },
      // another month: not counted here
      {
        id: "p2",
        kind: "doctor",
        name: "Dr. Kavita Shah",
        from: "2026-09-01",
        to: "2026-09-30",
        amountPaise: 99_00,
        paidAt: "",
        note: "",
      },
    ];
    const r = commissionReport(sales, batches, rates, range, paid, {
      from: "2026-10-01",
      to: "2026-10-31",
    });
    // profit: (100−60) + (200−60) = 180 → 20 % = 36
    expect(r.doctors[0]).toMatchObject({
      profitPaise: 180_00,
      commissionPaise: 36_00,
      paidPaise: 10_00,
      duePaise: 26_00,
    });
  });

  it("rates are kept sensible", () => {
    expect(
      cleanRates({
        basis: "x",
        doctors: {
          " Dr. A ": 12.345,
          "Dr. B": 0,
          "Dr. C": 80,
          "": 5,
          "Dr. D": "abc",
        },
      }),
    ).toEqual({
      basis: "sales",
      doctors: { "Dr. A": 12.35, "Dr. C": 50 },
      staff: {},
    });
  });
});
