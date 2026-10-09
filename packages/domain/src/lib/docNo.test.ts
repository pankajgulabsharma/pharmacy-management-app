import { describe, expect, it } from "vitest";
import { cleanPrefix, financialYear, nextDocNo } from "./docNo";

const at = (d: Date) => d.toISOString();

describe("document numbers per financial year", () => {
  it("April–March years", () => {
    expect(financialYear(new Date(2026, 9, 10)).label).toBe("26-27");
    expect(financialYear(new Date(2027, 2, 31, 23)).label).toBe("26-27");
    expect(financialYear(new Date(2027, 3, 1)).label).toBe("27-28");
    expect(financialYear(new Date(2000, 0, 5)).label).toBe("99-00");
  });

  it("counts up within the year, restarts at 0001 on 1 April", () => {
    const oct = new Date(2026, 9, 10);
    const docs = [
      { no: "INV/26-27/0009", at: at(oct) },
      { no: "INV/25-26/0950", at: at(new Date(2026, 2, 30)) },
    ];
    expect(nextDocNo(docs, "INV", oct)).toBe("INV/26-27/0010");
    expect(nextDocNo(docs, "INV", new Date(2027, 3, 1, 9))).toBe(
      "INV/27-28/0001",
    );
  });

  it("continues old-style numbers from the same year (INV-0816 → 0817)", () => {
    const oct = new Date(2026, 9, 10);
    const docs = [
      { no: "INV-0816", at: at(new Date(2026, 9, 9)) },
      { no: "INV-5000", at: at(new Date(2026, 1, 1)) }, // last year: ignored
    ];
    expect(nextDocNo(docs, "INV", oct)).toBe("INV/26-27/0817");
  });

  it("each prefix is its own series, and stays within GST's 16 characters", () => {
    const oct = new Date(2026, 9, 10);
    const docs = [{ no: "INV/26-27/0040", at: at(oct) }];
    expect(nextDocNo(docs, "MC", oct)).toBe("MC/26-27/0001");
    expect(nextDocNo([], "ABCDE", oct).length).toBeLessThanOrEqual(16);
    expect(cleanPrefix("inv-", "INV")).toBe("INV");
    expect(cleanPrefix("9AB", "INV")).toBe("INV");
    expect(cleanPrefix("toolong", "INV")).toBe("TOOLO");
  });
});
