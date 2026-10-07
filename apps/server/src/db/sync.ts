/**
 * Synchronous database helpers for the money-and-stock operations.
 *
 * Why synchronous: Node's SQLite runs each statement immediately, so a whole
 * operation (read stock → check rules → write bill + stock) runs start to
 * finish without any other request getting in between. Two counters selling
 * the last strip at the same moment can never both succeed.
 *
 * Column names, types and true/false conversion come from the Drizzle schema,
 * so these helpers can't drift from the tables.
 */
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { getTableColumns, getTableName } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

type Row = Record<string, unknown>;

function columnsOf(table: SQLiteTable) {
  return Object.entries(getTableColumns(table));
}

/** Everything inside fn is written together, or not at all */
export function writeTx<T>(raw: DatabaseSync, fn: () => T): T {
  raw.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    raw.exec("COMMIT");
    return result;
  } catch (err) {
    raw.exec("ROLLBACK");
    throw err;
  }
}

/** Insert rows; properties not in the table are ignored, missing ones use defaults */
export function insertRows(
  raw: DatabaseSync,
  table: SQLiteTable,
  rows: readonly Row[],
) {
  const cols = columnsOf(table);
  const name = getTableName(table);
  for (const row of rows) {
    const used = cols.filter(([key]) => row[key] !== undefined);
    const sql = `INSERT INTO "${name}" (${used.map(([, c]) => `"${c.name}"`).join(", ")}) VALUES (${used.map(() => "?").join(", ")})`;
    raw
      .prepare(sql)
      .run(
        ...used.map(
          ([key, c]) => c.mapToDriverValue(row[key]) as SQLInputValue,
        ),
      );
  }
}

/** Update one row by its key column; only the given properties change */
export function updateRow(
  raw: DatabaseSync,
  table: SQLiteTable,
  key: string,
  row: Row,
) {
  const cols = columnsOf(table);
  const keyCol = cols.find(([k]) => k === key)?.[1];
  if (!keyCol) throw new Error(`No column ${key}`);
  const used = cols.filter(([k]) => k !== key && row[k] !== undefined);
  if (used.length === 0) return;
  const sql = `UPDATE "${getTableName(table)}" SET ${used.map(([, c]) => `"${c.name}" = ?`).join(", ")} WHERE "${keyCol.name}" = ?`;
  raw
    .prepare(sql)
    .run(
      ...used.map(([k, c]) => c.mapToDriverValue(row[k]) as SQLInputValue),
      row[key] as SQLInputValue,
    );
}

/** Read rows as objects with the schema's property names (where = raw SQL with ? params) */
export function selectRows<T = Row>(
  raw: DatabaseSync,
  table: SQLiteTable,
  where = "",
  params: SQLInputValue[] = [],
  orderBy = "",
): T[] {
  const cols = columnsOf(table);
  const sql = `SELECT ${cols.map(([key, c]) => `"${c.name}" AS "${key}"`).join(", ")} FROM "${getTableName(table)}"${where ? ` WHERE ${where}` : ""}${orderBy ? ` ORDER BY ${orderBy}` : ""}`;
  const map = new Map(cols);
  return (raw.prepare(sql).all(...params) as Row[]).map((r) => {
    const out: Row = {};
    for (const k of Object.keys(r))
      out[k] = r[k] === null ? null : map.get(k)!.mapFromDriverValue(r[k]);
    return out as T;
  });
}
