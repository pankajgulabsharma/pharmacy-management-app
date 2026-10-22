import { describe, expect, it } from "vitest";
import {
  countNo,
  diffValuePaise,
  fromUnits,
  lineDiffUnits,
  postTarget,
  rackLabel,
  summarizeCount,
  toUnits,
  type StockCountLine,
} from "./stockCount";

const strip10 = { unit: "STP", unitsPerStrip: 10 };
const loose = { unit: "LSE", unitsPerStrip: 1 };
const line = (o: Partial<StockCountLine>): StockCountLine => ({
  countId: "c",
  batchId: "b",
  medicineId: "m",
  systemStrip: 5,
  systemLoose: 4,
  countedStrip: null,
  countedLoose: null,
  countedBy: "",
  countedAt: null,
  ...o,
});

describe("stock count", () => {
  it("converts strips and loose", () => {
    expect(toUnits(5, 4, strip10)).toBe(54);
    expect(fromUnits(54, strip10)).toEqual({ qtyStrip: 5, qtyLoose: 4 });
    expect(toUnits(3, 7, loose)).toBe(7);
    expect(fromUnits(7, loose)).toEqual({ qtyStrip: 0, qtyLoose: 7 });
  });

  it("difference is counted − snapshot; uncounted is 0", () => {
    expect(lineDiffUnits(line({}), strip10)).toBe(0);
    expect(
      lineDiffUnits(line({ countedStrip: 4, countedLoose: 9 }), strip10),
    ).toBe(-5);
  });

  it("posts the difference on today's stock; refuses below zero", () => {
    const l = line({ countedStrip: 4, countedLoose: 4 }); // 1 strip short
    // 2 strips sold since the snapshot
    expect(postTarget({ qtyStrip: 3, qtyLoose: 4 }, l, strip10)).toEqual({
      qtyStrip: 2,
      qtyLoose: 4,
    });
    expect(postTarget({ qtyStrip: 0, qtyLoose: 5 }, l, strip10)).toBeNull();
  });

  it("values differences at cost per unit", () => {
    expect(diffValuePaise(-5, 20, strip10)).toBe(-1000);
    expect(diffValuePaise(2, 3.5, loose)).toBe(700);
  });

  it("summarizes", () => {
    const s = summarizeCount(
      [
        line({ batchId: "1", countedStrip: 5, countedLoose: 4 }),
        line({ batchId: "2", countedStrip: 4, countedLoose: 4 }),
        line({ batchId: "3", countedStrip: 6, countedLoose: 4 }),
        line({ batchId: "4" }),
      ],
      () => strip10,
      () => 20,
    );
    expect(s).toEqual({
      lines: 4,
      counted: 3,
      matched: 1,
      short: 1,
      excess: 1,
      shortValuePaise: 2000,
      excessValuePaise: 2000,
    });
  });

  it("labels", () => {
    expect(countNo(3)).toBe("SC-0003");
    expect(rackLabel(" ")).toBe("No rack");
    expect(rackLabel("A1")).toBe("A1");
  });
});

describe("count sheet print", () => {
  it("variance lists only differences; a blind sheet hides the app's quantity", async () => {
    const { countSheetHtml } = await import("./countSheet");
    const count = {
      id: "x",
      countNo: "SC-0001",
      racks: ["A1"],
      status: "posted" as const,
      note: "",
      createdAt: "2026-10-22T07:00:00Z",
      createdBy: "Pankaj",
      postedAt: null,
      postedBy: "",
      summary: null,
    };
    const row = (medicine: string, diff: string, diffPaise: number) => ({
      rack: "A1",
      medicine,
      pack: "",
      batchNo: "B1",
      expiry: "05/29",
      system: "85 STP",
      counted: "84 STP",
      diff,
      diffPaise,
    });
    const rows = [row("Dolo", "−1 STP", -1560), row("Crocin", "", 0)];
    const shop = { name: "Shop" };
    const v = countSheetHtml({ shop, count, rows, mode: "variance" });
    expect(v).toContain("Dolo");
    expect(v).not.toContain("Crocin");
    const s = countSheetHtml({ shop, count, rows, mode: "sheet", blind: true });
    expect(s).toContain("Crocin");
    expect(s).not.toContain("85 STP");
  });
});
