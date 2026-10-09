/**
 * CSV import & export.
 *
 * Security: a cell starting with = + - @ (or tab / CR) is treated as a
 * FORMULA by Excel / Google Sheets — "CSV injection". A supplier name like
 * =HYPERLINK("http://evil") would run when the owner opens the export.
 * Such cells are prefixed with ' so spreadsheets show them as plain text.
 */
export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

const FORMULA_START = /^[=+\-@\t\r]/;
/** A plain number like "-6312.55" can never be a formula — keep it numeric */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Negative numbers are data, not formulas — leave them alone
  if (
    typeof value !== "number" &&
    !PLAIN_NUMBER.test(s) &&
    FORMULA_START.test(s)
  ) {
    s = `'${s}`;
  }
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
  { bom = true }: { bom?: boolean } = {},
): string {
  const head = columns.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((r) =>
    columns.map((c) => csvCell(c.value(r))).join(","),
  );
  // BOM so Excel opens ₹ and Hindi text as UTF-8 (the GST tool wants none)
  return `${bom ? "\uFEFF" : ""}${[head, ...body].join("\r\n")}`;
}

/**
 * Reads a CSV / tab-separated file (Excel "Save as CSV", Marg / Tally
 * exports) into rows of cells. Handles quotes, commas and line breaks
 * inside quotes, and picks the separator (, ; or tab) from the header.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = [",", ";", "\t"].reduce((best, c) =>
    firstLine.split(c).length > firstLine.split(best).length ? c : best,
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

/** "Item Name" / "item_name" / "ITEM-NAME" → "item name" */
export const normalizeHeader = (h: string) =>
  h
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();

/**
 * Rows → records with OUR field names, whatever the file calls its
 * columns: `aliases` lists, per field, the headers other software uses.
 */
export function csvRecords<K extends string>(
  text: string,
  aliases: Record<K, readonly string[]>,
): { records: Partial<Record<K, string>>[]; found: K[] } {
  const [head = [], ...rows] = parseCsv(text);
  const headers = head.map(normalizeHeader);
  const index = new Map<K, number>();
  for (const [key, names] of Object.entries(aliases) as [K, string[]][]) {
    const i = headers.findIndex((h) => names.includes(h));
    if (i >= 0) index.set(key, i);
  }
  return {
    records: rows.map((cells) => {
      const r: Partial<Record<K, string>> = {};
      for (const [k, i] of index) r[k] = (cells[i] ?? "").trim();
      return r;
    }),
    found: [...index.keys()],
  };
}
