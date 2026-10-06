import type { Settings } from "./types";

/** Factory defaults — also what "Reset to defaults" restores */
export const DEFAULT_SETTINGS: Settings = {
  shop: {
    name: "MediCare Pharmacy",
    address: "Shop 4, Station Road, Thane (W) 400601",
    phone: "02225401234",
    email: "",
    gstin: "27AABCM1234F1ZX",
    drugLicense: "MH-TZ3-20B-552901 / 21B-552902",
  },
  billing: {
    defaultCounter: "Counter 1",
    defaultPaymentMethod: "cash",
    receiptFooter:
      "Thank you! Get well soon. Medicines are returnable only with this bill.",
  },
  inventory: {
    expiringSoonDays: 90,
    purchaseShortExpiryMonths: 6,
  },
  doctors: [
    "Dr. Prakash Iyer, MD (Cardiologist)",
    "Dr. Anita Mehta, MBBS",
    "Dr. Suresh Rao, MD",
  ],
  counters: ["Counter 1", "Counter 2", "Counter 3"],
};
