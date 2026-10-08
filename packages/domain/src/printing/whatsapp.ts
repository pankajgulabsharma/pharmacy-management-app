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

/** The bill as a short WhatsApp message (*bold* is WhatsApp formatting) */
export function billMessage(sale: Sale, shopName: string, footer = ""): string {
  const qty = (l: Sale["lines"][number]) =>
    [
      l.qtyStrip ? `${l.qtyStrip} ${l.unit}` : "",
      l.qtyLoose ? `${l.qtyLoose} loose` : "",
    ]
      .filter(Boolean)
      .join(" + ");
  const date = new Date(sale.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return [
    `*${shopName}*`,
    `Bill ${sale.billNo} · ${date}`,
    "",
    ...sale.lines.map(
      (l) => `${l.medicineName} × ${qty(l)} — ₹${formatPaise(l.amountPaise)}`,
    ),
    "",
    `*Total: ₹${formatPaise(sale.totals.netPaise)}*`,
    footer,
  ]
    .filter((x, i, a) => x !== "" || a[i - 1] !== "")
    .join("\n")
    .trim();
}

export function whatsappLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
