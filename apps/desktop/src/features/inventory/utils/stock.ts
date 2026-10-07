/**
 * Stock rules live in @medicare/domain. Here the app plugs in the user's
 * Settings → "Expiring soon" window as the default.
 */
import * as rules from "@medicare/domain/inventory/stock";
import type { InventoryBatch } from "@medicare/domain/inventory/types";
import { getExpiringSoonDays } from "@/features/settings/store/useSettingsStore";

export * from "@medicare/domain/inventory/stock";

export const isExpiringSoon = (
  expiry: string,
  days = getExpiringSoonDays(),
  now = new Date(),
) => rules.isExpiringSoon(expiry, days, now);

export const batchStatus = (
  b: InventoryBatch,
  totals: ReadonlyMap<string, number>,
  now = new Date(),
  expiringDays = getExpiringSoonDays(),
) => rules.batchStatus(b, totals, now, expiringDays);

export const batchStatuses = (
  batches: readonly InventoryBatch[],
  now = new Date(),
  expiringDays = getExpiringSoonDays(),
) => rules.batchStatuses(batches, now, expiringDays);
