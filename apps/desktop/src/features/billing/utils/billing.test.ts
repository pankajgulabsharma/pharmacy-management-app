import { describe, expect, it } from "vitest";
import type { StockBatch } from "@/features/inventory/types";
import type { Medicine } from "@/features/medicines/types";
import { applyChange } from "@/features/inventory/utils/ledger";
import { EMPTY_PAYMENT, type PaymentDraft, type SaleInput } from "../types";
import { allocateFefo, sellableBatches, stockLimits } from "./allocate";
import { priceLine } from "./pricing";
import { SaleError, buildSale, nextBillNo, validatePayment } from "./sale";
import { buildSaleReturn, getReturnableSaleLines } from "./saleReturn";

const NOW = new Date(2026, 9, 2, 12); // 2 Oct 2026

const dolo: Medicine = {
  id: "m2",
  name: "Dolo 650",
  salt: "Paracetamol",
  brand: "Micro Labs",
  category: "tablet_capsule",
  hsn: "30049099",
  barcode: "",
  rack: "A1",
  unit: "STP",
  unitsPerStrip: 10,
  allowLoose: true,
  mrp: 30,
  salePrice: 30,
  minStock: 5,
  gstPercent: 5,
  status: "active",
};

function batch(over: Partial<StockBatch>): StockBatch {
  return {
    id: "b",
    medicineId: "m2",
    batchNo: "B",
    expiry: "12/27",
    qtyStrip: 0,
    qtyLoose: 0,
    mrp: 30,
    purchasePrice: 20,
    receivedAt: "2026-09-01T00:00:00Z",
    ...over,
  };
}

const BATCHES = [
  batch({ id: "late", batchNo: "LATE", expiry: "06/28", qtyStrip: 10 }),
  batch({
    id: "early",
    batchNo: "EARLY",
    expiry: "01/27",
    qtyStrip: 2,
    qtyLoose: 3,
  }),
  batch({ id: "expired", batchNo: "OLD", expiry: "08/26", qtyStrip: 50 }),
];

const meds = new Map([[dolo.id, dolo]]);
const cash = (received: string): PaymentDraft => ({
  ...EMPTY_PAYMENT,
  received,
});

function input(over: Partial<SaleInput> = {}): SaleInput {
  return {
    cart: [
      {
        lineId: "c1",
        medicineId: "m2",
        qtyStrip: 1,
        qtyLoose: 0,
        discountPercent: 0,
      },
    ],
    customerName: "",
    doctor: "",
    counter: "Counter 1",
    payment: cash("100"),
    ...over,
  };
}

describe("FEFO allocation", () => {
  it("never offers expired batches and sorts earliest expiry first", () => {
    expect(sellableBatches(BATCHES, "m2", NOW).map((b) => b.id)).toEqual([
      "early",
      "late",
    ]);
  });

  it("takes whole strips from the earliest batch first", () => {
    const a = allocateFefo(sellableBatches(BATCHES, "m2", NOW), dolo, 3, 0);
    expect(a.allocations.map((x) => [x.batchId, x.qtyStrip])).toEqual([
      ["early", 2],
      ["late", 1],
    ]);
    expect(a.shortStrip).toBe(0);
  });

  it("sells loose from loose stock first, then opens a strip", () => {
    // early: 3 loose on hand; 5 more must come from opening 1 strip
    const a = allocateFefo(sellableBatches(BATCHES, "m2", NOW), dolo, 0, 8);
    expect(a.allocations[0]).toMatchObject({
      batchId: "early",
      qtyLoose: 8,
      breakStrips: 1,
    });
  });

  it("reports a shortfall instead of overselling", () => {
    const a = allocateFefo(sellableBatches(BATCHES, "m2", NOW), dolo, 13, 0);
    expect(a.shortStrip).toBe(1); // 2 + 10 sellable, expired 50 ignored
  });

  it("limits loose by strips not sold whole", () => {
    const sellable = sellableBatches(BATCHES, "m2", NOW);
    expect(stockLimits(sellable, dolo, 0)).toEqual({
      maxStrip: 12,
      maxLoose: 3 + 120,
    });
    expect(stockLimits(sellable, dolo, 12)).toEqual({
      maxStrip: 12,
      maxLoose: 3,
    });
  });
});

describe("pricing (GST is inside the price)", () => {
  it("customer pays the price; GST is split out of it", () => {
    const m105: Medicine = { ...dolo, mrp: 105, salePrice: 105 };
    const [a] = allocateFefo(
      [batch({ id: "x", qtyStrip: 5, mrp: 105 })],
      m105,
      1,
      0,
    ).allocations;
    const p = priceLine([a], 10, 0, 5);
    expect(p.amountPaise).toBe(10_500); // ₹105, not ₹110.25
    expect(p.taxablePaise).toBe(10_000);
    expect(p.gstPaise).toBe(500);
  });

  it("never charges above the batch MRP", () => {
    const cheapBatch = batch({ id: "x", qtyStrip: 5, mrp: 25 }); // older print
    const [a] = allocateFefo([cheapBatch], dolo, 1, 0).allocations;
    expect(a.ratePaise).toBe(2_500);
  });

  it("loose price is pack price ÷ units", () => {
    const [a] = allocateFefo(
      [batch({ id: "x", qtyStrip: 1 })],
      dolo,
      0,
      3,
    ).allocations;
    expect(priceLine([a], 10, 0, 5).amountPaise).toBe(900); // 3 × ₹3
  });
});

describe("buildSale", () => {
  it("builds a bill and the exact stock change (incl. opened strip)", () => {
    const { sale, change } = buildSale(
      input({
        cart: [
          {
            lineId: "c",
            medicineId: "m2",
            qtyStrip: 1,
            qtyLoose: 8,
            discountPercent: 0,
          },
        ],
      }),
      meds,
      BATCHES,
      "INV-0001",
      NOW,
    );
    expect(sale.totals.netPaise).toBe(3_000 + 2_400);
    const after = applyChange(BATCHES, {
      refId: sale.id,
      type: "sale",
      note: "",
      at: NOW,
      lines: change,
    });
    const early = after.batches.find((b) => b.id === "early")!;
    // 2 strips + 3 loose: 1 strip sold whole; 8 loose = 3 on hand + 5 from
    // opening the last strip (10 tablets) → 5 tablets remain loose
    expect(early).toMatchObject({ qtyStrip: 0, qtyLoose: 5 });
  });

  it.each([
    [{ cart: [] }, /at least one/],
    [
      {
        cart: [
          {
            lineId: "c",
            medicineId: "m2",
            qtyStrip: 99,
            qtyLoose: 0,
            discountPercent: 0,
          },
        ],
      },
      /not enough stock/,
    ],
    [
      {
        cart: [
          {
            lineId: "c",
            medicineId: "m2",
            qtyStrip: 1,
            qtyLoose: 0,
            discountPercent: 50,
          },
        ],
      },
      /invalid discount/,
    ],
    [
      {
        cart: [
          {
            lineId: "c",
            medicineId: "nope",
            qtyStrip: 1,
            qtyLoose: 0,
            discountPercent: 0,
          },
        ],
      },
      /no longer exists/,
    ],
    [{ payment: cash("10") }, /less than the total/],
    [
      { payment: { ...EMPTY_PAYMENT, method: "udhaar" as const } },
      /customer's account/,
    ],
  ])("rejects %o", (over, msg) => {
    expect(() =>
      buildSale(input(over), meds, BATCHES, "INV-0001", NOW),
    ).toThrow(msg);
  });

  it("rejects the same medicine twice", () => {
    const line = {
      lineId: "a",
      medicineId: "m2",
      qtyStrip: 1,
      qtyLoose: 0,
      discountPercent: 0,
    };
    expect(() =>
      buildSale(
        input({ cart: [line, { ...line, lineId: "b" }] }),
        meds,
        BATCHES,
        "INV-1",
        NOW,
      ),
    ).toThrow(SaleError);
  });

  it("one-key cash bill: nothing typed means the exact amount", () => {
    const { sale } = buildSale(
      input({ payment: cash("") }),
      meds,
      BATCHES,
      "INV-0001",
      NOW,
    );
    expect(sale.payment).toMatchObject({ method: "cash", changePaise: 0 });
    expect(sale.payment.receivedPaise).toBe(sale.totals.netPaise);
  });

  it("split payments must add up exactly", () => {
    const split = (cashV: string, upi: string): PaymentDraft => ({
      ...EMPTY_PAYMENT,
      method: "split",
      split: { cash: cashV, upi, card: "" },
    });
    expect(validatePayment(split("10", "10"), 3000, "")).toMatch(/add up/);
    expect(validatePayment(split("10", "20"), 3000, "")).toBeNull();
  });

  it("numbers bills sequentially", () => {
    expect(nextBillNo([])).toBe("INV-0001");
    expect(nextBillNo([{ billNo: "INV-0041" }, { billNo: "INV-0007" }])).toBe(
      "INV-0042",
    );
  });
});

describe("sales return", () => {
  const { sale } = buildSale(
    input({
      cart: [
        {
          lineId: "c",
          medicineId: "m2",
          qtyStrip: 3,
          qtyLoose: 0,
          discountPercent: 0,
        },
      ],
    }),
    meds,
    BATCHES,
    "INV-0001",
    NOW,
  );
  const base = {
    saleId: sale.id,
    reason: "Wrong medicine",
    refundMode: "cash" as const,
    notes: "",
  };

  it("puts goods back on the same batches, latest expiry first", () => {
    const { ret, change } = buildSaleReturn(
      sale,
      {
        ...base,
        lines: [{ saleLineId: sale.lines[0].id, qtyStrip: 1, qtyLoose: 0 }],
      },
      [],
      "SR-0001",
      NOW,
    );
    expect(change).toEqual([
      { batchId: "late", qtyStripDelta: 1, qtyLooseDelta: 0 },
    ]);
    expect(ret.refundPaise).toBe(3_000);
  });

  it("never returns more than sold minus earlier returns", () => {
    const first = buildSaleReturn(
      sale,
      {
        ...base,
        lines: [{ saleLineId: sale.lines[0].id, qtyStrip: 2, qtyLoose: 0 }],
      },
      [],
      "SR-0001",
      NOW,
    ).ret;
    expect(getReturnableSaleLines(sale, [first])[0].maxStrip).toBe(1);
    expect(() =>
      buildSaleReturn(
        sale,
        {
          ...base,
          lines: [{ saleLineId: sale.lines[0].id, qtyStrip: 2, qtyLoose: 0 }],
        },
        [first],
        "SR-0002",
        NOW,
      ),
    ).toThrow(/at most 1/);
  });

  it("only udhaar bills can be adjusted against udhaar", () => {
    expect(() =>
      buildSaleReturn(
        sale,
        {
          ...base,
          refundMode: "udhaar_adjust",
          lines: [{ saleLineId: sale.lines[0].id, qtyStrip: 1, qtyLoose: 0 }],
        },
        [],
        "SR-0001",
        NOW,
      ),
    ).toThrow(/only for udhaar/);
  });
});
