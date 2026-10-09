import type { PaymentMethod } from "../billing/types";

export type ShopProfile = {
  name: string;
  address: string;
  phone: string;
  email: string;
  /** Optional for very small shops below the GST threshold */
  gstin: string;
  /** Retail drug licence no(s). (Form 20 / 21) — printed on every bill */
  drugLicense: string;
};

export type BillingPrefs = {
  defaultCounter: string;
  defaultPaymentMethod: PaymentMethod;
  /** Printed at the bottom of every bill */
  receiptFooter: string;
  /** Start of every bill number: INV → INV/26-27/0001 (1–5 letters/digits) */
  billPrefix: string;
};

export type InventoryPrefs = {
  /** Batches expiring within this many days are flagged "Expiring soon" */
  expiringSoonDays: number;
  /** Purchase lines expiring within this many months get a warning */
  purchaseShortExpiryMonths: number;
};

export type Settings = {
  shop: ShopProfile;
  billing: BillingPrefs;
  inventory: InventoryPrefs;
  doctors: string[];
  counters: string[];
};

export const SETTINGS_LIMITS = {
  shopNameMax: 80,
  addressMax: 200,
  emailMax: 80,
  licenseMax: 80,
  footerMax: 160,
  doctorMax: 80,
  counterMax: 30,
  maxDoctors: 50,
  maxCounters: 10,
  expiringDays: { min: 15, max: 365 },
  shortExpiryMonths: { min: 1, max: 24 },
} as const;
