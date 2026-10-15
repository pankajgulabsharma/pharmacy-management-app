/**
 * Send a bill on WhatsApp — free: no API, no SMS gateway. The app opens
 * WhatsApp (app or web) with the customer's number and the bill already
 * typed; the shop just presses Send.
 */
import type { Sale } from "../billing/types";
import { formatPaise } from "../lib/money";

/** 10-digit Indian mobile → "91XXXXXXXXXX"; anything else → null */
export function whatsappNumber(raw: string): string | null {
  const d = raw.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(d) ? `91${d}` : null;
}

/* ------------------------------------------------------------------ */
/* WhatsApp look — one style for every message the shop sends          */
/*   *bold*  _italic_  emoji headings, a divider line, numbered items  */
/* ------------------------------------------------------------------ */

/** The shop as a message needs it (Settings → Shop profile) */
export type WhatsAppShop = { name: string; address?: string; phone?: string };

export const WA_LINE = "━━━━━━━━━━━━━━━━━━";

const KEYCAPS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
/** 1️⃣ … 🔟, then "11." — numbered items read well on a phone */
export const waNumber = (i: number) => KEYCAPS[i] ?? `*${i + 1}.*`;

/** "🏥 *SHOP NAME*" + address line */
export function waShopHeader(shop: WhatsAppShop): string[] {
  return [
    `🏥 *${shop.name.toUpperCase()}*`,
    ...(shop.address?.trim() ? [`📍 _${shop.address.trim()}_`] : []),
  ];
}

/** "📞 022-…" at the bottom when the shop has a phone */
export const waShopFooter = (shop: WhatsAppShop) =>
  shop.phone?.trim() ? [`📞 ${shop.phone.trim()}`] : [];

const waDate = (d: Date, withTime = false) =>
  d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });

/** Joins lines, never two empty lines in a row */
export const waJoin = (lines: readonly string[]) =>
  lines
    .filter((x, i, a) => x !== "" || (i > 0 && a[i - 1] !== ""))
    .join("\n")
    .trim();

const PAYMENT: Record<string, string> = {
  cash: "💵 Paid in cash",
  upi: "📲 Paid by UPI",
  card: "💳 Paid by card",
  wallet: "👛 Paid by wallet",
  split: "✅ Paid (split)",
  udhaar: "📒 On account (udhaar)",
};

/** The bill as a WhatsApp message */
export function billMessage(
  sale: Sale,
  shop: WhatsAppShop | string,
  footer = "",
): string {
  const s = typeof shop === "string" ? { name: shop } : shop;
  const qty = (l: Sale["lines"][number]) =>
    [
      l.qtyStrip ? `${l.qtyStrip} ${l.unit}` : "",
      l.qtyLoose ? `${l.qtyLoose} loose` : "",
    ]
      .filter(Boolean)
      .join(" + ");
  const t = sale.totals;
  const customer = sale.customerName?.trim();
  return waJoin([
    ...waShopHeader(s),
    WA_LINE,
    `🧾 *Bill:* ${sale.billNo}`,
    `📅 ${waDate(new Date(sale.createdAt), true)}`,
    ...(customer && !/^walk-?in/i.test(customer) ? [`👤 ${customer}`] : []),
    WA_LINE,
    ...sale.lines.flatMap((l, i) => [
      `${waNumber(i)} *${l.medicineName}*`,
      `      ${qty(l)}  →  ₹${formatPaise(l.amountPaise)}`,
    ]),
    WA_LINE,
    ...(t.discountPaise > 0
      ? [`🏷️ You saved: ₹${formatPaise(t.discountPaise)}`]
      : []),
    `💰 *TOTAL: ₹${formatPaise(t.netPaise)}*`,
    ...(sale.payment?.method ? [PAYMENT[sale.payment.method] ?? ""] : []),
    WA_LINE,
    // The shop's own note (Settings → Billing), else a friendly line
    footer.trim() ? `💊 _${footer.trim()}_ 🙏` : "💊 _Get well soon!_ 🙏",
    ...waShopFooter(s),
  ]);
}

export function whatsappLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
