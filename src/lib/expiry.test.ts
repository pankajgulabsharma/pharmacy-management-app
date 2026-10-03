import { describe, expect, it } from "vitest";
import {
  compareExpiry,
  expiryEndDate,
  formatExpiryInput,
  isExpiringWithin,
  isExpiryPast,
  isValidExpiry,
} from "./expiry";

const NOW = new Date(2026, 9, 2); // 2 Oct 2026

describe("expiry (MM/YY)", () => {
  it("accepts only real months", () => {
    expect(isValidExpiry("08/27")).toBe(true);
    expect(isValidExpiry("13/27")).toBe(false);
    expect(isValidExpiry("8/27")).toBe(false);
    expect(isValidExpiry("02/11/26")).toBe(false);
  });

  it("is valid until the last day of the month", () => {
    expect(expiryEndDate("02/28")?.getDate()).toBe(29); // 2028 is a leap year
    expect(isExpiryPast("10/26", NOW)).toBe(false); // this month = still OK
    expect(isExpiryPast("09/26", NOW)).toBe(true);
  });

  it("reads MM/YY, not DD/MM (regression for the old inventory parser)", () => {
    // Old code read "08/26" as 8th of a far-future month → never expired
    expect(isExpiryPast("08/26", NOW)).toBe(true);
    // Old code read "02/11" as 2 Nov → "expiring soon"; it is Feb 2011
    expect(isExpiryPast("02/11", NOW)).toBe(true);
  });

  it("flags batches expiring within the window", () => {
    expect(isExpiringWithin("12/26", 90, NOW)).toBe(true);
    expect(isExpiringWithin("06/27", 90, NOW)).toBe(false);
    expect(isExpiringWithin("09/26", 90, NOW)).toBe(false); // already expired
  });

  it("sorts earliest first", () => {
    expect(["08/28", "01/27", "12/26"].sort(compareExpiry)).toEqual([
      "12/26",
      "01/27",
      "08/28",
    ]);
  });

  it("formats while typing", () => {
    expect(formatExpiryInput("0827")).toBe("08/27");
    expect(formatExpiryInput("08/2")).toBe("08/2");
    expect(formatExpiryInput("ab12")).toBe("12");
  });
});
