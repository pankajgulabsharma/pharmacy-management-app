import {
  diffValuePaise,
  fromUnits,
  isCounted,
  lineDiffUnits,
  rackLabel,
  type StockCountLine,
} from "@medicare/domain/inventory/stockCount";
import type { CountSheetRow } from "@medicare/domain/inventory/countSheet";
import type { InventoryBatch } from "@medicare/domain/inventory/types";
import { formatPackLabel } from "@medicare/domain/medicines/types";

export type CountRow = {
  line: StockCountLine;
  batch: InventoryBatch | undefined;
  name: string;
  rack: string;
  /** Loose-unit pack info for maths */
  pack: { unit: string; unitsPerStrip: number };
  /** Counted strips + loose is possible (not a LSE item) */
  hasStrips: boolean;
  diffUnits: number;
  diffPaise: number;
  counted: boolean;
};

/** "5 STP + 4" · "7 LSE" */
export function qtyText(strip: number, loose: number, unit: string) {
  if (unit === "LSE") return `${loose} LSE`;
  return `${strip} ${unit}${loose ? ` + ${loose}` : ""}`;
}

/** "−1 STP − 4" style difference, from loose units */
export function diffText(units: number, pack: CountRow["pack"]) {
  if (!units) return "";
  const sign = units < 0 ? "−" : "+";
  const q = fromUnits(Math.abs(units), pack);
  return `${sign}${qtyText(q.qtyStrip, q.qtyLoose, pack.unit)}`;
}

export function buildRows(
  lines: readonly StockCountLine[],
  byId: ReadonlyMap<string, InventoryBatch>,
): CountRow[] {
  return lines
    .map((line) => {
      const b = byId.get(line.batchId);
      const pack = {
        unit: b?.unit ?? "STP",
        unitsPerStrip: b?.unitsPerStrip ?? 1,
      };
      const d = lineDiffUnits(line, pack);
      return {
        line,
        batch: b,
        name: b?.medicineName ?? "(removed medicine)",
        rack: b?.rack.trim() ?? "",
        pack,
        hasStrips: pack.unit !== "LSE",
        diffUnits: d,
        diffPaise: d ? diffValuePaise(d, b?.purchasePrice ?? 0, pack) : 0,
        counted: isCounted(line),
      };
    })
    .sort(
      (a, b) =>
        // Racks in order ("No rack" last), then medicine, then batch
        (a.rack ? 0 : 1) - (b.rack ? 0 : 1) ||
        a.rack.localeCompare(b.rack, "en", { numeric: true }) ||
        a.name.localeCompare(b.name) ||
        (a.batch?.expiry ?? "").localeCompare(b.batch?.expiry ?? ""),
    );
}

export function sheetRows(rows: readonly CountRow[]): CountSheetRow[] {
  return rows.map((r) => ({
    rack: r.rack,
    medicine: r.name,
    pack: r.batch ? formatPackLabel(r.batch.unit, r.batch.unitsPerStrip) : "",
    batchNo: r.batch?.batchNo ?? "",
    expiry: r.batch?.expiry ?? "",
    system: qtyText(r.line.systemStrip, r.line.systemLoose, r.pack.unit),
    counted: r.counted
      ? qtyText(r.line.countedStrip ?? 0, r.line.countedLoose ?? 0, r.pack.unit)
      : "not counted",
    diff: diffText(r.diffUnits, r.pack),
    diffPaise: r.diffPaise,
  }));
}

export const racksText = (racks: readonly string[]) =>
  racks.length ? racks.map(rackLabel).join(", ") : "All racks";
