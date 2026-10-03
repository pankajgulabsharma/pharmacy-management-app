/**
 * Demo data composition root.
 *
 * Builds one consistent starting state for all stores using the SAME pure
 * functions the app uses at runtime — so demo data always obeys the real
 * rules (stock received for posted invoices, returns reduce stock, etc.).
 *
 * TODO(api): delete this file when data comes from the backend.
 */
import { mockMedicines } from "@/features/medicines/data/mockMedicines";
import { mockStockBatches } from "@/features/inventory/data/mockStock";
import type { StockBatch, StockMovement } from "@/features/inventory/types";
import {
  applyIssue,
  applyReceipt,
  openingMovements,
} from "@/features/inventory/utils/ledger";
import { mockPurchases } from "@/features/purchases/data/mockPurchases";
import type {
  Purchase,
  PurchaseReturn,
  ReturnReason,
} from "@/features/purchases/types";
import { purchaseToStockReceipt } from "@/features/purchases/utils/receipt";
import {
  buildPurchaseReturn,
  getReturnableLines,
  nextReturnNo,
} from "@/features/purchases/utils/returns";
import { toISODate } from "@/lib/date";

function buildDemo() {
  const known = new Set(mockMedicines.map((m) => m.id));
  let batches: StockBatch[] = [...mockStockBatches];
  const movements: StockMovement[] = openingMovements(mockStockBatches);
  const receivedRefs: Record<string, true> = {};

  // 1) Receive stock for invoices entered in the app (oldest first)
  const posted = mockPurchases.filter((p) => p.stockPosted).reverse();
  for (const p of posted) {
    const r = applyReceipt(batches, purchaseToStockReceipt(p), known);
    batches = r.batches;
    movements.push(...r.movements);
    receivedRefs[p.id] = true;
  }

  // 2) Two sample debit notes so the Returns tab isn't empty
  const purchases: Purchase[] = mockPurchases.map((p) => ({ ...p }));
  const returns: PurchaseReturn[] = [];
  const samples: { index: number; reason: ReturnReason; notes: string }[] = [
    { index: 2, reason: "damaged", notes: "Strips crushed in transit" },
    {
      index: 5,
      reason: "near_expiry",
      notes: "Short expiry — supplier agreed to take back",
    },
  ];

  for (const sample of samples) {
    const purchase = purchases.filter((p) => p.stockPosted)[sample.index];
    if (!purchase) continue;
    const returnable = getReturnableLines(purchase, returns, batches);
    const first = returnable.find((r) => r.max > 0);
    if (!first) continue;

    const at = new Date(purchase.createdAt);
    const { ret, issue } = buildPurchaseReturn(
      purchase,
      {
        purchaseId: purchase.id,
        date: toISODate(at),
        reason: sample.reason,
        notes: sample.notes,
        lines: [{ purchaseLineId: first.line.id, qty: Math.min(2, first.max) }],
      },
      returnable,
      nextReturnNo(returns),
      at,
    );
    const r = applyIssue(batches, {
      refId: ret.id,
      type: "purchase_return",
      note: `Return ${ret.returnNo} · ${ret.supplierName}`,
      at,
      lines: issue,
    });
    batches = r.batches;
    movements.push(...r.movements);
    returns.unshift(ret);
    purchase.returnedPaise += ret.totalPaise;
  }

  // Movement log is stored newest first
  movements.sort((a, b) => b.at.localeCompare(a.at));

  return {
    inventory: { batches, movements, receivedRefs },
    purchases,
    returns,
  };
}

const demo = buildDemo();

export const demoInventory = demo.inventory;
export const demoPurchases = demo.purchases;
export const demoReturns = demo.returns;
