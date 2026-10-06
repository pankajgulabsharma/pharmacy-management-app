import { describe, expect, it } from "vitest";
import { mockSuppliers } from "@medicare/demo/data/mockSuppliers";
import { checkGstin, gstinCheckChar } from "@medicare/domain/lib/gstin";

describe("GSTIN", () => {
  it("computes the official check character", () => {
    // Widely published sample GSTIN
    expect(gstinCheckChar("27AAPFU0939F1Z")).toBe("V");
  });

  it("accepts valid GSTINs and reports the state", () => {
    const r = checkGstin("27aapfu0939f1zv");
    expect(r).toMatchObject({
      ok: true,
      stateName: "Maharashtra",
      pan: "AAPFU0939F",
    });
  });

  it.each([
    ["27AAPFU0939F1ZX", /check digit/],
    ["99AAPFU0939F1ZV", /state code/],
    ["27AAPFU0939F1Z", /15 characters/],
    ["27AAPF10939F1ZV", /format/],
  ])("rejects %s", (value, reason) => {
    const r = checkGstin(value);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(reason);
  });

  it("all demo suppliers have valid GSTINs", () => {
    for (const s of mockSuppliers) expect(checkGstin(s.gstin).ok).toBe(true);
  });
});
