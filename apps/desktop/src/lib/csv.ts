/**
 * CSV export.
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
): string {
  const head = columns.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((r) =>
    columns.map((c) => csvCell(c.value(r))).join(","),
  );
  // BOM so Excel opens ₹ and Hindi text as UTF-8
  return `\uFEFF${[head, ...body].join("\r\n")}`;
}

/** Saves text as a file in the browser (no server involved) */
export function downloadText(
  filename: string,
  text: string,
  type = "text/csv;charset=utf-8",
) {
  const safeName =
    filename.replace(/[^\w.-]+/g, "_").slice(0, 100) || "export.csv";
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
