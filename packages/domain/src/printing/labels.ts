/**
 * Barcodes for things that come without one (loose stock, own packs), and
 * the sticker sheet/roll they print on.
 *
 * In-store codes are EAN-13 starting with "2" — the range GS1 reserves for
 * use inside a shop, so they never clash with a manufacturer's barcode, and
 * every scanner reads them.
 */
import { esc } from "./receipt";

export type LabelSize = "50x25" | "38x25" | "50x30" | "a4-65" | "a4-24";

export const LABEL_SIZES: Record<
  LabelSize,
  {
    label: string;
    hint: string;
    /** One label */
    w: number;
    h: number;
    /** Sheet layout (A4 sticker paper); absent = label-printer roll */
    sheet?: {
      cols: number;
      rows: number;
      top: number;
      left: number;
      gapX: number;
      gapY: number;
    };
  }
> = {
  "50x25": {
    label: "Roll 50 × 25 mm",
    hint: "Label printer (TSC, Zebra, TVS LP…) — most common",
    w: 50,
    h: 25,
  },
  "38x25": {
    label: "Roll 38 × 25 mm",
    hint: "Label printer — small stickers",
    w: 38,
    h: 25,
  },
  "50x30": {
    label: "Roll 50 × 30 mm",
    hint: "Label printer — bigger stickers",
    w: 50,
    h: 30,
  },
  "a4-65": {
    label: "A4 sheet, 65 labels (38 × 21 mm)",
    hint: "Laser / inkjet on ready-made A4 sticker sheets",
    w: 38.1,
    h: 21.2,
    sheet: { cols: 5, rows: 13, top: 10.7, left: 4.65, gapX: 2.5, gapY: 0 },
  },
  "a4-24": {
    label: "A4 sheet, 24 labels (70 × 37 mm)",
    hint: "Laser / inkjet on ready-made A4 sticker sheets",
    w: 70,
    h: 37,
    sheet: { cols: 3, rows: 8, top: 0.5, left: 0, gapX: 0, gapY: 0 },
  },
};

/** EAN-13 check digit for the first 12 digits */
export function ean13CheckDigit(d12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d12[i]) * (i % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code) === Number(code[12]);
}

/**
 * A new in-store code ("2" + 11 digits + check digit) that no medicine
 * uses yet. `random` is injectable for tests.
 */
export function newInStoreBarcode(
  taken: ReadonlySet<string>,
  random: () => number = Math.random,
): string {
  for (;;) {
    let d = "2";
    for (let i = 0; i < 11; i++) d += Math.floor(random() * 10);
    const code = d + ean13CheckDigit(d);
    if (!taken.has(code)) return code;
  }
}

export type LabelItem = {
  name: string;
  /** e.g. "MRP ₹48.00" */
  price: string;
  /** Barcode drawing (SVG markup, made by the screen) */
  barcodeSvg: string;
  extra?: string;
};

export function labelsHtml(
  items: LabelItem[],
  size: LabelSize,
  shopName: string,
): string {
  const s = LABEL_SIZES[size];
  const one = (it: LabelItem) => `<div class="lbl">
<div class="shop">${esc(shopName)}</div>
<div class="name">${esc(it.name)}</div>
<div class="bc">${it.barcodeSvg}</div>
<div class="row"><b>${esc(it.price)}</b>${it.extra ? `<span>${esc(it.extra)}</span>` : ""}</div></div>`;
  const small = s.h < 25;
  const css = `
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
.lbl { width: ${s.w}mm; height: ${s.h}mm; padding: 1mm 1.5mm; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; }
.shop { font-size: ${small ? 5.5 : 6.5}px; text-transform: uppercase; letter-spacing: .3px; white-space: nowrap; overflow: hidden; }
.name { font-size: ${small ? 7 : 8.5}px; font-weight: 700; line-height: 1.1; max-height: 2.2em; overflow: hidden; }
.bc { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
.bc svg { width: 100%; height: 100%; }
.row { display: flex; justify-content: space-between; font-size: ${small ? 7 : 8}px; }
${
  s.sheet
    ? `@page { size: A4; margin: 0; }
.sheet { padding: ${s.sheet.top}mm 0 0 ${s.sheet.left}mm; display: grid; grid-template-columns: repeat(${s.sheet.cols}, ${s.w}mm); column-gap: ${s.sheet.gapX}mm; row-gap: ${s.sheet.gapY}mm; page-break-after: always; }`
    : `@page { size: ${s.w}mm ${s.h}mm; margin: 0; }
.lbl { page-break-after: always; }`
}`;
  let body: string;
  if (s.sheet) {
    const per = s.sheet.cols * s.sheet.rows;
    const pages: string[] = [];
    for (let i = 0; i < items.length; i += per)
      pages.push(
        `<div class="sheet">${items
          .slice(i, i + per)
          .map(one)
          .join("")}</div>`,
      );
    body = pages.join("");
  } else body = items.map(one).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Labels</title><style>${css}</style></head><body>${body}</body></html>`;
}
