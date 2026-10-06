/**
 * Sales returns — goods come back to the SAME batches they were sold
 * from, and never more than was sold (minus earlier returns).
 */
import type { StockChangeLine } from "@/features/inventory/types";
import { newId } from "@/lib/id";
import { roundToRupee } from "@/lib/money";
import { cleanText } from "@/lib/sanitize";
import {
  BILLING_LIMITS,
  REFUND_MODE_LABELS,
  type Sale,
  type SaleLine,
  type SaleReturn,
  type SaleReturnInput,
  type SaleReturnLine,
} from "../types";

export class SaleReturnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleReturnError";
  }
}

/** "SR-0001", … */
export function nextSaleReturnNo(
  returns: readonly Pick<SaleReturn, "returnNo">[],
): string {
  let max = 0;
  for (const r of returns) {
    const n = Number(/^SR-(\d+)$/.exec(r.returnNo)?.[1] ?? 0);
    if (n > max) max = n;
  }
  return `SR-${String(max + 1).padStart(4, "0")}`;
}

type Returned = {
  strip: number;
  loose: number;
  byBatch: Map<string, { strip: number; loose: number }>;
};

/** What has already been returned, per sale line and per batch */
export function returnedBySaleLine(
  returns: readonly SaleReturn[],
  saleId: string,
): Map<string, Returned> {
  const map = new Map<string, Returned>();
  for (const r of returns) {
    if (r.saleId !== saleId) continue;
    for (const l of r.lines) {
      const x = map.get(l.saleLineId) ?? {
        strip: 0,
        loose: 0,
        byBatch: new Map(),
      };
      x.strip += l.qtyStrip;
      x.loose += l.qtyLoose;
      for (const b of l.batches) {
        const y = x.byBatch.get(b.batchId) ?? { strip: 0, loose: 0 };
        y.strip += b.qtyStrip;
        y.loose += b.qtyLoose;
        x.byBatch.set(b.batchId, y);
      }
      map.set(l.saleLineId, x);
    }
  }
  return map;
}

export type ReturnableSaleLine = {
  line: SaleLine;
  maxStrip: number;
  maxLoose: number;
  returnedStrip: number;
  returnedLoose: number;
};

export function getReturnableSaleLines(
  sale: Sale,
  returns: readonly SaleReturn[],
): ReturnableSaleLine[] {
  const done = returnedBySaleLine(returns, sale.id);
  return sale.lines.map((line) => {
    const r = done.get(line.id);
    return {
      line,
      returnedStrip: r?.strip ?? 0,
      returnedLoose: r?.loose ?? 0,
      maxStrip: line.qtyStrip - (r?.strip ?? 0),
      maxLoose: line.qtyLoose - (r?.loose ?? 0),
    };
  });
}

/** Refund for part of a line: the same share of what the customer paid */
export function returnAmount(
  line: SaleLine,
  qtyStrip: number,
  qtyLoose: number,
): number {
  const soldUnits = line.qtyStrip * line.unitsPerStrip + line.qtyLoose;
  if (soldUnits === 0) return 0;
  const units = qtyStrip * line.unitsPerStrip + qtyLoose;
  return Math.round((line.amountPaise * units) / soldUnits);
}

/** Spread returned quantities back over the batches the line was sold from */
function backToBatches(
  line: SaleLine,
  already: Returned | undefined,
  qtyStrip: number,
  qtyLoose: number,
) {
  const out: { batchId: string; qtyStrip: number; qtyLoose: number }[] = [];
  let strip = qtyStrip;
  let loose = qtyLoose;
  // Latest-expiry batch first, so the earliest stock keeps selling first
  for (const a of [...line.allocations].reverse()) {
    const prev = already?.byBatch.get(a.batchId) ?? { strip: 0, loose: 0 };
    const s = Math.min(strip, a.qtyStrip - prev.strip);
    const l = Math.min(loose, a.qtyLoose - prev.loose);
    if (s > 0 || l > 0)
      out.push({ batchId: a.batchId, qtyStrip: s, qtyLoose: l });
    strip -= Math.max(0, s);
    loose -= Math.max(0, l);
  }
  return out;
}

export function buildSaleReturn(
  sale: Sale,
  input: SaleReturnInput,
  returns: readonly SaleReturn[],
  returnNo: string,
  now: Date,
): { ret: SaleReturn; change: StockChangeLine[] } {
  if (sale.imported) {
    throw new SaleReturnError(
      "This is imported history — it can't be returned here",
    );
  }
  const reason = cleanText(input.reason, 80);
  if (!reason) throw new SaleReturnError("Choose a reason");
  if (!(input.refundMode in REFUND_MODE_LABELS))
    throw new SaleReturnError("Choose a refund mode");
  if (input.refundMode === "udhaar_adjust" && sale.status !== "udhaar") {
    throw new SaleReturnError("Udhaar adjustment is only for udhaar bills");
  }

  const done = returnedBySaleLine(returns, sale.id);
  const byId = new Map(sale.lines.map((l) => [l.id, l]));
  const seen = new Set<string>();
  const lines: SaleReturnLine[] = [];
  const change: StockChangeLine[] = [];

  for (const want of input.lines) {
    if (want.qtyStrip === 0 && want.qtyLoose === 0) continue;
    if (seen.has(want.saleLineId))
      throw new SaleReturnError("Same item listed twice");
    seen.add(want.saleLineId);
    const line = byId.get(want.saleLineId);
    if (!line) throw new SaleReturnError("Item is not on this bill");
    if (
      ![want.qtyStrip, want.qtyLoose].every(
        (n) => Number.isInteger(n) && n >= 0,
      )
    ) {
      throw new SaleReturnError(
        `${line.medicineName}: quantity must be a whole number`,
      );
    }
    const prev = done.get(line.id);
    const maxStrip = line.qtyStrip - (prev?.strip ?? 0);
    const maxLoose = line.qtyLoose - (prev?.loose ?? 0);
    if (want.qtyStrip > maxStrip || want.qtyLoose > maxLoose) {
      throw new SaleReturnError(
        `${line.medicineName}: you can return at most ${maxStrip} ${line.unit}${maxLoose > 0 ? ` + ${maxLoose} loose` : ""}`,
      );
    }

    const batches = backToBatches(line, prev, want.qtyStrip, want.qtyLoose);
    lines.push({
      id: newId("srl"),
      saleLineId: line.id,
      medicineId: line.medicineId,
      medicineName: line.medicineName,
      unit: line.unit,
      unitsPerStrip: line.unitsPerStrip,
      qtyStrip: want.qtyStrip,
      qtyLoose: want.qtyLoose,
      amountPaise: returnAmount(line, want.qtyStrip, want.qtyLoose),
      batches,
    });
    for (const b of batches) {
      change.push({
        batchId: b.batchId,
        qtyStripDelta: b.qtyStrip,
        qtyLooseDelta: b.qtyLoose,
      });
    }
  }

  if (lines.length === 0)
    throw new SaleReturnError("Enter a quantity for at least one item");

  const raw = lines.reduce((s, l) => s + l.amountPaise, 0);
  const { rounded, roundOff } = roundToRupee(raw);
  const remaining = sale.totals.netPaise - sale.returnedPaise;
  const refundPaise = Math.min(rounded, remaining);

  return {
    ret: {
      id: newId("sr"),
      returnNo,
      saleId: sale.id,
      billNo: sale.billNo,
      customerName: sale.customerName,
      createdAt: now.toISOString(),
      reason,
      refundMode: input.refundMode,
      notes: cleanText(input.notes, BILLING_LIMITS.notesMax),
      lines,
      roundOffPaise: roundOff,
      refundPaise,
    },
    change,
  };
}
