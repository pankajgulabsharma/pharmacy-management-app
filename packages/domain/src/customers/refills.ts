/**
 * Refill reminders — customers who buy the same medicine again and again
 * (BP, sugar, thyroid…) are told before it runs out. The shop keeps the
 * customer; the customer doesn't run out. Free: a WhatsApp click, no SMS.
 *
 * "Again and again" = bought on at least 2 bills; the next one is due
 * after the usual gap between their purchases.
 */
import type { Sale } from "../billing/types";
import type { Customer } from "./types";
import {
  WA_LINE,
  waJoin,
  waShopFooter,
  type WhatsAppShop,
} from "../printing/whatsapp";

export type RefillDue = {
  /** customerId|medicineId */
  key: string;
  customerId: string;
  customerName: string;
  phone: string;
  medicineId: string;
  medicineName: string;
  /** Last bill with it (ISO) */
  lastAt: string;
  /** The bill id of that purchase — a reminder is "done" until a new one */
  lastSaleId: string;
  /** Usual days between purchases */
  everyDays: number;
  /** When the next one is due (ISO date) */
  dueOn: string;
  /** < 0 = overdue by that many days */
  daysLeft: number;
  /** How many bills it was on */
  times: number;
};

const DAY = 86_400_000;
/** Too close together = same illness, not a refill (e.g. 2 bills in a day) */
const MIN_GAP_DAYS = 7;

/**
 * Refills due from `-overdueDays` (missed) to `+aheadDays` (coming up).
 * Customers who stopped long ago (more than 3 gaps late) are left out.
 */
export function refillsDue(
  sales: readonly Sale[],
  customers: readonly Customer[],
  opts: { aheadDays?: number; overdueDays?: number } = {},
  now = new Date(),
): RefillDue[] {
  const ahead = opts.aheadDays ?? 5;
  const overdue = opts.overdueDays ?? 15;
  const byId = new Map(
    customers.filter((c) => c.status === "active").map((c) => [c.id, c]),
  );

  // customer|medicine → purchase days (one per bill)
  const bought = new Map<
    string,
    { at: number; saleId: string; name: string }[]
  >();
  for (const s of sales) {
    if (!s.customerId || !byId.has(s.customerId)) continue;
    const at = Date.parse(s.createdAt);
    const seen = new Set<string>();
    for (const l of s.lines) {
      if (seen.has(l.medicineId)) continue;
      seen.add(l.medicineId);
      const key = `${s.customerId}|${l.medicineId}`;
      const list = bought.get(key) ?? [];
      list.push({ at, saleId: s.id, name: l.medicineName });
      bought.set(key, list);
    }
  }

  const out: RefillDue[] = [];
  for (const [key, raw] of bought) {
    if (raw.length < 2) continue;
    const list = raw.sort((a, b) => a.at - b.at);
    // Gaps between purchases, ignoring repeat bills a few days apart
    const gaps: number[] = [];
    for (let i = 1; i < list.length; i++) {
      const g = (list[i].at - list[i - 1].at) / DAY;
      if (g >= MIN_GAP_DAYS) gaps.push(g);
    }
    if (gaps.length === 0) continue;
    gaps.sort((a, b) => a - b);
    // Median gap: one late month doesn't move the reminder much
    const mid = Math.floor(gaps.length / 2);
    const every = Math.round(
      gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2,
    );
    const last = list[list.length - 1];
    const due = last.at + every * DAY;
    const daysLeft = Math.round((due - now.getTime()) / DAY);
    if (daysLeft > ahead || daysLeft < -overdue) continue;
    if (now.getTime() - last.at > every * 3 * DAY) continue;
    const [customerId, medicineId] = key.split("|");
    const c = byId.get(customerId)!;
    out.push({
      key,
      customerId,
      customerName: c.name,
      phone: c.phone,
      medicineId,
      medicineName: last.name,
      lastAt: new Date(last.at).toISOString(),
      lastSaleId: last.saleId,
      everyDays: every,
      dueOn: new Date(due).toISOString().slice(0, 10),
      daysLeft,
      times: list.length,
    });
  }
  // Overdue first, then the soonest
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** WhatsApp message for one customer (all their medicines due together) */
export function refillMessage(
  customerName: string,
  medicines: readonly string[],
  shop: WhatsAppShop | string,
): string {
  const s = typeof shop === "string" ? { name: shop } : shop;
  return waJoin([
    `🙏 Namaste *${customerName}* ji,`,
    "",
    "💊 Aapki regular dawai khatam hone wali hai:",
    ...medicines.map((m) => `   ▪️ *${m}*`),
    "",
    `✅ *${s.name}* par available hai.`,
    "👉 Reply karein — hum aapke liye ready rakh denge.",
    WA_LINE,
    "_Swasth rahein, khush rahein!_ 🌿",
    ...waShopFooter(s),
  ]);
}
