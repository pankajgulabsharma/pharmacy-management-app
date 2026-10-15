import { DEFAULT_BILL_PREFIX } from "../lib/docNo";
import { DEFAULT_ROLE_ACCESS } from "../auth/permissions";
import type { Settings } from "./types";

/** The software's own name — fixed (the shop's name is in Settings) */
export const APP_NAME = "MediCare Pharmacy";

/** Until the owner fills Settings → Shop profile */
export const UNNAMED_SHOP = "My Medical Store";

/**
 * Factory defaults for a NEW shop — also what "Reset to defaults"
 * restores (the shop profile itself is kept). Nothing made up: the shop's
 * name, address, GSTIN and drug licence are the owner's to fill in, and
 * they print on every bill.
 */
export const DEFAULT_SETTINGS: Settings = {
  shop: {
    name: UNNAMED_SHOP,
    address: "",
    phone: "",
    email: "",
    gstin: "",
    drugLicense: "",
  },
  billing: {
    defaultCounter: "Counter 1",
    defaultPaymentMethod: "cash",
    receiptFooter:
      "Thank you! Get well soon. Medicines are returnable only with this bill.",
    billPrefix: DEFAULT_BILL_PREFIX,
    // A sensible start; the owner changes it in Settings → Billing
    defaultUdhaarLimitPaise: 5_000_00,
  },
  inventory: {
    expiringSoonDays: 90,
    purchaseShortExpiryMonths: 6,
  },
  doctors: [],
  counters: ["Counter 1"],
  roles: DEFAULT_ROLE_ACCESS,
};

/** The demo shop (development seed and tests) */
export const DEMO_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  shop: {
    name: "Shree Sai Medical & General Stores",
    address: "Shop 4, Station Road, Thane (W) 400601",
    phone: "02225401234",
    email: "",
    gstin: "27AABCM1234F1ZX",
    drugLicense: "MH-TZ3-20B-552901 / 21B-552902",
  },
  doctors: [
    "Dr. Prakash Iyer, MD (Cardiologist)",
    "Dr. Anita Mehta, MBBS",
    "Dr. Suresh Rao, MD",
  ],
  counters: ["Counter 1", "Counter 2", "Counter 3"],
};

/** Shop details still missing that every bill needs (for a reminder) */
export const missingShopDetails = (s: Settings["shop"]): string[] =>
  [
    s.name.trim() === UNNAMED_SHOP || !s.name.trim() ? "shop name" : "",
    s.address.trim() ? "" : "address",
    s.drugLicense.trim() ? "" : "drug licence no.",
  ].filter(Boolean);
