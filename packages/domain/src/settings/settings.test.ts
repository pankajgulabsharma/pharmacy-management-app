import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, DEMO_SETTINGS } from "./defaults";
import {
  applySettingsChange,
  cleanList,
  sanitizeSettings,
  validateShop,
} from "./validation";
import { checkGstin } from "../lib/gstin";

describe("settings", () => {
  it("default shop profile is valid (incl. GSTIN check digit)", () => {
    expect(validateShop(DEMO_SETTINGS.shop)).toEqual({});
    expect(checkGstin(DEMO_SETTINGS.shop.gstin).ok).toBe(true);
    // a new shop starts blank — nothing made up prints on its bills
    expect(DEFAULT_SETTINGS.shop).toMatchObject({
      gstin: "",
      address: "",
      drugLicense: "",
    });
    expect(DEFAULT_SETTINGS.doctors).toEqual([]);
  });

  it("repairs tampered / corrupted storage instead of crashing", () => {
    const s = sanitizeSettings({
      shop: { name: 42, gstin: "BAD", phone: "+91 98200-12345" },
      billing: { defaultPaymentMethod: "bitcoin", defaultCounter: "Nope" },
      inventory: { expiringSoonDays: 99999, purchaseShortExpiryMonths: "6" },
      doctors: "not a list",
      counters: [],
    });
    expect(s.shop.name).toBe(DEFAULT_SETTINGS.shop.name);
    expect(s.shop.gstin).toBe(DEFAULT_SETTINGS.shop.gstin);
    expect(s.shop.phone).toBe("919820012345".slice(0, 11));
    expect(s.billing.defaultPaymentMethod).toBe("cash");
    expect(s.counters).toEqual(DEFAULT_SETTINGS.counters);
    expect(s.billing.defaultCounter).toBe(s.counters[0]);
    expect(s.inventory.expiringSoonDays).toBe(90);
    expect(s.inventory.purchaseShortExpiryMonths).toBe(6);
  });

  it("cleans lists: trims, drops blanks and case-insensitive duplicates", () => {
    expect(cleanList([" Dr. A ", "", "dr. a", "Dr. B", 7], 10, 80)).toEqual([
      "Dr. A",
      "Dr. B",
    ]);
  });

  it("accepts an empty GSTIN (shops below the GST threshold)", () => {
    expect(
      validateShop({ ...DEMO_SETTINGS.shop, gstin: "" }).gstin,
    ).toBeUndefined();
  });
});

describe("saving a settings change (server)", () => {
  it("refuses invalid shop details instead of silently replacing them", () => {
    expect(() =>
      applySettingsChange(DEMO_SETTINGS, {
        shop: { ...DEMO_SETTINGS.shop, phone: "123" },
      }),
    ).toThrow(/10-digit/);
    expect(() =>
      applySettingsChange(DEFAULT_SETTINGS, {
        inventory: { ...DEFAULT_SETTINGS.inventory, expiringSoonDays: 2 },
      }),
    ).toThrow(/days/);
  });

  it("changes only the section sent and cleans lists", () => {
    const next = applySettingsChange(DEFAULT_SETTINGS, {
      doctors: [" Dr. A ", "dr. a", ""],
    });
    expect(next.doctors).toEqual(["Dr. A"]);
    expect(next.shop).toEqual(DEFAULT_SETTINGS.shop);
  });
});

describe("default udhaar limit for new customers", () => {
  it("starts at ₹5,000 and old saved settings get it too", () => {
    expect(DEFAULT_SETTINGS.billing.defaultUdhaarLimitPaise).toBe(5_000_00);
    const old = { billing: { billPrefix: "INV" } }; // saved before this setting
    expect(sanitizeSettings(old).billing.defaultUdhaarLimitPaise).toBe(
      5_000_00,
    );
  });

  it("keeps 0 (no limit) and rejects bad values", () => {
    const at = (v: unknown) =>
      sanitizeSettings({ billing: { defaultUdhaarLimitPaise: v } }).billing
        .defaultUdhaarLimitPaise;
    expect(at(0)).toBe(0);
    expect(at(10_000_00)).toBe(10_000_00);
    expect(at(-5)).toBe(5_000_00);
    expect(at(1.5)).toBe(5_000_00);
    expect(at(99_00_00_000_00)).toBe(5_000_00);
  });
});
