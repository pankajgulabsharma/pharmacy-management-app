import type { Purchase } from "./types";
import { isOpeningDue } from "./opening";

/**
 * Business rules for changing a saved invoice — ONE place, used by both
 * the UI (to disable buttons and explain why) and the store (to enforce).
 */
export type PurchaseRuleContext = {
  /** Debit notes already raised against this invoice */
  returnCount: number;
  /**
   * Is the stock this invoice added still fully on the shelf?
   * (false once part of it is sold, returned or adjusted away)
   */
  stockReversible: boolean;
};

export type RuleResult = { allowed: true } | { allowed: false; reason: string };

const OK: RuleResult = { allowed: true };
const no = (reason: string): RuleResult => ({ allowed: false, reason });

const OPENING =
  "Old balance from before MediCare — only payments can be recorded on it";

export function canEditPurchase(
  p: Purchase,
  ctx: PurchaseRuleContext,
): RuleResult {
  if (p.status === "cancelled") return no("This invoice is cancelled");
  if (isOpeningDue(p)) return no(OPENING);
  if (!p.stockPosted) {
    return no(
      "Imported history (entered before stock tracking) — it can't be edited",
    );
  }
  if (ctx.returnCount > 0) {
    return no("A return was made against this invoice — it can't be edited");
  }
  if (!ctx.stockReversible) {
    return no(
      "Part of this stock is already sold or adjusted — it can't be edited",
    );
  }
  return OK;
}

export function canCancelPurchase(
  p: Purchase,
  ctx: PurchaseRuleContext,
): RuleResult {
  if (p.status === "cancelled") return no("This invoice is already cancelled");
  // A wrong old balance can be cancelled until something is paid on it
  if (isOpeningDue(p))
    return p.paidPaise > 0
      ? no("A payment is recorded on this old balance — it can't be cancelled")
      : OK;
  if (!p.stockPosted) {
    return no(
      "Imported history (entered before stock tracking) — it can't be cancelled",
    );
  }
  if (p.paidPaise > 0) {
    return no(
      "A payment is recorded — paid invoices can't be cancelled. Use a purchase return.",
    );
  }
  if (ctx.returnCount > 0) {
    return no("A return was made against this invoice — it can't be cancelled");
  }
  if (!ctx.stockReversible) {
    return no(
      "Part of this stock is already sold or adjusted — use a purchase return instead",
    );
  }
  return OK;
}

export function canReturnPurchase(p: Purchase): RuleResult {
  if (p.status === "cancelled") return no("This invoice is cancelled");
  if (isOpeningDue(p)) return no(OPENING);
  if (!p.stockPosted) {
    return no(
      "Imported history (entered before stock tracking) — its batches aren't in stock",
    );
  }
  return OK;
}

export function canRecordPayment(p: Purchase): RuleResult {
  if (p.status === "cancelled") return no("This invoice is cancelled");
  return OK;
}
