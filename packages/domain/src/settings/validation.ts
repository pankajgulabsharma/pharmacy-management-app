import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "../billing/types";
import { checkGstin } from "../lib/gstin";
import { RuleError } from "../lib/errors";
import { cleanText } from "../lib/sanitize";
import {
  SETTINGS_LIMITS as L,
  type BillingPrefs,
  type InventoryPrefs,
  type Settings,
  type ShopProfile,
} from "./types";
import { DEFAULT_SETTINGS } from "./defaults";

export type Errors<T> = Partial<Record<keyof T, string>>;

const PHONE_RE = /^(?:[6-9]\d{9}|0\d{9,10})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const digitsOnly = (v: string) => v.replace(/\D/g, "");

export function validateShop(s: ShopProfile): Errors<ShopProfile> {
  const e: Errors<ShopProfile> = {};
  if (cleanText(s.name, L.shopNameMax).length < 2)
    e.name = "Shop name is required";
  if (cleanText(s.address, L.addressMax).length < 5)
    e.address = "Address is required";
  if (!PHONE_RE.test(digitsOnly(s.phone)))
    e.phone = "Enter a 10-digit mobile or STD landline";
  if (s.email.trim() && !EMAIL_RE.test(s.email.trim()))
    e.email = "Invalid email";
  if (s.gstin.trim()) {
    const g = checkGstin(s.gstin);
    if (!g.ok) e.gstin = g.reason;
  }
  if (cleanText(s.drugLicense, L.licenseMax).length < 3) {
    e.drugLicense =
      "Drug licence no. is required — it is printed on every bill";
  }
  return e;
}

export function validateInventory(p: InventoryPrefs): Errors<InventoryPrefs> {
  const e: Errors<InventoryPrefs> = {};
  const d = L.expiringDays;
  if (
    !Number.isInteger(p.expiringSoonDays) ||
    p.expiringSoonDays < d.min ||
    p.expiringSoonDays > d.max
  ) {
    e.expiringSoonDays = `${d.min}–${d.max} days`;
  }
  const m = L.shortExpiryMonths;
  if (
    !Number.isInteger(p.purchaseShortExpiryMonths) ||
    p.purchaseShortExpiryMonths < m.min ||
    p.purchaseShortExpiryMonths > m.max
  ) {
    e.purchaseShortExpiryMonths = `${m.min}–${m.max} months`;
  }
  return e;
}

/** Clean a list: trim, drop empties and duplicates (case-insensitive), cap size */
export function cleanList(
  list: unknown,
  maxItems: number,
  maxLen: number,
): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const v = cleanText(item, maxLen);
    const key = v.toLowerCase();
    if (!v || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= maxItems) break;
  }
  return out;
}

const str = (v: unknown, max: number, fallback: string) =>
  typeof v === "string" ? cleanText(v, max) : fallback;

function int(v: unknown, min: number, max: number, fallback: number) {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max
    ? v
    : fallback;
}

/**
 * Turns ANY stored value into valid Settings. Used when reading from
 * browser storage, which the user (or another script) can edit — every
 * field is type-checked, bounded and cleaned, and falls back to defaults.
 */
export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const shop = (r.shop && typeof r.shop === "object" ? r.shop : {}) as Record<
    string,
    unknown
  >;
  const billing = (
    r.billing && typeof r.billing === "object" ? r.billing : {}
  ) as Record<string, unknown>;
  const inv = (
    r.inventory && typeof r.inventory === "object" ? r.inventory : {}
  ) as Record<string, unknown>;

  const counters = cleanList(r.counters, L.maxCounters, L.counterMax);
  const safeCounters = counters.length > 0 ? counters : d.counters;
  const defaultCounter = str(billing.defaultCounter, L.counterMax, "");
  const method = billing.defaultPaymentMethod;

  const gstin = str(shop.gstin, 15, d.shop.gstin).toUpperCase();

  return {
    shop: {
      name: str(shop.name, L.shopNameMax, d.shop.name) || d.shop.name,
      address: str(shop.address, L.addressMax, d.shop.address),
      phone: digitsOnly(str(shop.phone, 16, d.shop.phone)).slice(0, 11),
      email: str(shop.email, L.emailMax, d.shop.email).toLowerCase(),
      gstin: gstin === "" || checkGstin(gstin).ok ? gstin : d.shop.gstin,
      drugLicense: str(shop.drugLicense, L.licenseMax, d.shop.drugLicense),
    },
    billing: {
      defaultCounter: safeCounters.includes(defaultCounter)
        ? defaultCounter
        : safeCounters[0],
      defaultPaymentMethod:
        typeof method === "string" && method in PAYMENT_METHOD_LABELS
          ? (method as PaymentMethod)
          : d.billing.defaultPaymentMethod,
      receiptFooter: str(
        billing.receiptFooter,
        L.footerMax,
        d.billing.receiptFooter,
      ),
    },
    inventory: {
      expiringSoonDays: int(
        inv.expiringSoonDays,
        L.expiringDays.min,
        L.expiringDays.max,
        d.inventory.expiringSoonDays,
      ),
      purchaseShortExpiryMonths: int(
        inv.purchaseShortExpiryMonths,
        L.shortExpiryMonths.min,
        L.shortExpiryMonths.max,
        d.inventory.purchaseShortExpiryMonths,
      ),
    },
    doctors: Array.isArray(r.doctors)
      ? cleanList(r.doctors, L.maxDoctors, L.doctorMax)
      : d.doctors,
    counters: safeCounters,
  };
}

export type { BillingPrefs };

/**
 * A change sent by the app (one or more sections). Shop details and stock
 * alerts must be valid — a wrong value is refused, not quietly replaced —
 * then everything is cleaned exactly like sanitizeSettings().
 */
export function applySettingsChange(
  current: Settings,
  change: Partial<Settings>,
): Settings {
  const merged = { ...current, ...change };
  const first = (e: Record<string, string | undefined>) =>
    Object.values(e).find(Boolean);
  const bad =
    (change.shop && first(validateShop(merged.shop))) ||
    (change.inventory && first(validateInventory(merged.inventory)));
  if (bad) throw new RuleError(bad);
  return sanitizeSettings(merged);
}
