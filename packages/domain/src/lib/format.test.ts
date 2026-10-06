import { describe, expect, it } from "vitest";
import { percentChange, plural } from "./format";

describe("format", () => {
  it("percentChange never divides by zero", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
  });
  it("plural", () => {
    expect(plural(1, "bill")).toBe("1 bill");
    expect(plural(2, "batch", "batches")).toBe("2 batches");
  });
});
