import { memo, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Check, X } from "lucide-react";
import { formatPackLabel } from "@medicare/domain/medicines/types";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { cellInputClass } from "@/components/common/formStyles";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { diffText, qtyText, type CountRow } from "./rows";
import type { CountEntry } from "./useStockCountStore";

const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

/** Enter → the next batch's first box (counting goes down the shelf) */
function nextRow(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const all = [
    ...document.querySelectorAll<HTMLInputElement>("[data-count-first]"),
  ];
  const row = e.currentTarget.closest("tr");
  const i = all.findIndex((el) => el.closest("tr") === row);
  const next = all[i + 1];
  if (next) {
    next.focus();
    next.select();
  } else e.currentTarget.blur();
}

/**
 * One batch on the count screen: what the app says (unless counting
 * blind), boxes for what is on the shelf, the difference. Saved when you
 * leave the row (Tab / Enter / click elsewhere).
 */
export const CountLineRow = memo(function CountLineRow({
  row,
  blind,
  editable,
  onSave,
}: {
  row: CountRow;
  blind: boolean;
  editable: boolean;
  onSave: (e: CountEntry) => void;
}) {
  const { line, batch, pack } = row;
  const [strip, setStrip] = useState(
    line.countedStrip === null ? "" : String(line.countedStrip),
  );
  const [loose, setLoose] = useState(
    line.countedLoose === null || (!line.countedLoose && row.hasStrips)
      ? ""
      : String(line.countedLoose),
  );
  const looseBox =
    !row.hasStrips || Boolean(batch?.allowLoose) || line.systemLoose > 0;

  const commit = (s = strip, l = loose) => {
    const empty = !s.trim() && !l.trim();
    if (empty) {
      if (row.counted)
        onSave({ batchId: line.batchId, qtyStrip: null, qtyLoose: null });
      return;
    }
    const qtyStrip = row.hasStrips ? num(s) : 0;
    const qtyLoose = num(l);
    if (
      row.counted &&
      qtyStrip === line.countedStrip &&
      qtyLoose === line.countedLoose
    )
      return;
    onSave({ batchId: line.batchId, qtyStrip, qtyLoose });
  };
  const onRowBlur = (e: FocusEvent<HTMLTableRowElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commit();
  };
  const matches = () => {
    const s = row.hasStrips ? String(line.systemStrip) : "";
    const l = line.systemLoose
      ? String(line.systemLoose)
      : row.hasStrips
        ? ""
        : "0";
    setStrip(s);
    setLoose(l);
    commit(s || "0", l);
  };
  const clear = () => {
    setStrip("");
    setLoose("");
    commit("", "");
  };

  const diff = diffText(row.diffUnits, pack);
  const box = cn(cellInputClass, "h-7 w-16 text-right tabular-nums");

  return (
    <tr
      onBlur={editable ? onRowBlur : undefined}
      className={cn(
        "border-b border-border/60 text-[11.5px]",
        row.counted && !row.diffUnits && "bg-emerald-500/[0.04]",
        row.diffUnits < 0 && "bg-rose-500/[0.05]",
        row.diffUnits > 0 && "bg-sky-500/[0.05]",
      )}
    >
      <td className="py-1.5 pl-3 pr-2">
        <p className="truncate font-medium leading-tight">{row.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {batch ? formatPackLabel(batch.unit, batch.unitsPerStrip) : ""}
          {batch
            ? ` · ${tr("Batch")} ${batch.batchNo} · ${tr("Exp")} ${batch.expiry}`
            : ""}
        </p>
      </td>
      {blind ? null : (
        <td className="px-2 text-right tabular-nums text-muted-foreground">
          {qtyText(line.systemStrip, line.systemLoose, pack.unit)}
        </td>
      )}
      <td className="px-2">
        {editable ? (
          <div className="flex items-center justify-end gap-1">
            {row.hasStrips ? (
              <input
                data-count-first
                inputMode="numeric"
                aria-label={tr("{{unit}} counted", { unit: pack.unit })}
                value={strip}
                placeholder={pack.unit}
                onChange={(e) =>
                  setStrip(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                onKeyDown={nextRow}
                onFocus={(e) => e.target.select()}
                className={box}
              />
            ) : null}
            {looseBox ? (
              <>
                {row.hasStrips ? (
                  <span className="text-[10px] text-muted-foreground">+</span>
                ) : null}
                <input
                  {...(row.hasStrips ? {} : { "data-count-first": true })}
                  inputMode="numeric"
                  aria-label={tr("Loose counted")}
                  value={loose}
                  placeholder={row.hasStrips ? tr("loose") : "LSE"}
                  onChange={(e) =>
                    setLoose(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onKeyDown={nextRow}
                  onFocus={(e) => e.target.select()}
                  className={cn(box, row.hasStrips && "w-12")}
                />
              </>
            ) : null}
          </div>
        ) : (
          <p className="text-right tabular-nums">
            {row.counted ? (
              qtyText(line.countedStrip ?? 0, line.countedLoose ?? 0, pack.unit)
            ) : (
              <span className="text-muted-foreground">{tr("not counted")}</span>
            )}
          </p>
        )}
      </td>
      <td className="px-2 text-right tabular-nums">
        {!row.counted ? (
          <span className="text-muted-foreground">—</span>
        ) : diff ? (
          <span
            className={
              row.diffUnits < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-sky-600 dark:text-sky-400"
            }
          >
            <span className="font-medium">{diff}</span>
            <span className="block text-[10px] opacity-80">
              {inrFromPaise(Math.abs(row.diffPaise))}
            </span>
          </span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400">
            {tr("Matches")}
          </span>
        )}
      </td>
      <td className="w-16 pr-2 text-right">
        {editable ? (
          <div className="flex justify-end gap-0.5">
            {blind ? null : (
              <button
                type="button"
                title={tr("Same as the app")}
                aria-label={tr("Same as the app")}
                onClick={matches}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            )}
            {row.counted ? (
              <button
                type="button"
                title={tr("Clear count")}
                aria-label={tr("Clear count")}
                onClick={clear}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
      </td>
    </tr>
  );
});
