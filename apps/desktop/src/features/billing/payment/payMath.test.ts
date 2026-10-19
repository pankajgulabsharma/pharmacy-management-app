import { describe, expect, it } from "vitest";
import { quickCash } from "./payMath";

describe("quick cash buttons", () => {
  it("exact, then round amounts and notes above the bill", () => {
    expect(quickCash(18_750)).toEqual([18_750, 19_000, 20_000, 50_000]);
    expect(quickCash(36_000)).toEqual([36_000, 40_000, 50_000, 200_000]);
    expect(quickCash(0)).toEqual([]);
  });
});
