import { describe, expect, it } from "vitest";
import { hasFeature, planOf } from "./plan";

describe("plans", () => {
  it("from the key, else from how many computers it allows", () => {
    expect(planOf("active", 1)).toBe("single");
    expect(planOf("active", 3)).toBe("multi");
    expect(planOf("active", 3, "single")).toBe("single");
    expect(planOf("grace", 1, "multi")).toBe("multi");
  });
  it("trial is single computer, development shows everything", () => {
    expect(planOf("trial", 1)).toBe("single");
    expect(planOf("trial", 3)).toBe("single");
    expect(planOf("off", null)).toBe("multi");
  });
  it("staff commission is a multi-counter feature", () => {
    expect(hasFeature("single", "staffCommission")).toBe(false);
    expect(hasFeature("multi", "staffCommission")).toBe(true);
  });
});
