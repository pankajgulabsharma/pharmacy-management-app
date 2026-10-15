import { useId, useRef, useState } from "react";
import { Check, Download, FileUp } from "lucide-react";
import type { Medicine } from "@medicare/domain/medicines/types";
import type { PurchaseLineDraft } from "@medicare/domain/purchases/types";
import {
  INVOICE_SAMPLE_CSV,
  fillLine,
  parseInvoiceCsv,
  type InvoiceImport,
} from "@medicare/domain/purchases/invoiceCsv";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/common/ModalShell";
import { DialogCloseButton } from "@/components/common/DialogCloseButton";
import { downloadText } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Distributor's invoice file → lines on this purchase. Nothing is saved
 * here: the lines land in the form, where the shop checks and saves.
 */
export function InvoiceImportDialog({
  medicines,
  room,
  onAdd,
  onClose,
}: {
  medicines: readonly Medicine[];
  /** Lines still allowed on this invoice */
  room: number;
  onAdd: (
    lines: PurchaseLineDraft[],
    header: { invoiceNo: string; invoiceDate: string },
  ) => void;
  onClose: () => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState("");
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<InvoiceImport | null>(null);
  /** Unmatched rows whose suggestion was accepted (by row number) */
  const [accepted, setAccepted] = useState<Set<number>>(new Set());

  const read = async (f: File) => {
    setFile(f.name);
    setParsed(null);
    setAccepted(new Set());
    setError("");
    if (!/\.csv$/i.test(f.name) && f.type !== "text/csv")
      return setError(tr("Please choose a .csv file (Excel → Save as CSV)"));
    if (f.size > MAX_FILE_BYTES)
      return setError(tr("File is larger than 2 MB"));
    setParsed(parseInvoiceCsv(await f.text(), medicines));
  };

  const lines = parsed
    ? [
        ...parsed.lines,
        ...parsed.unmatched
          .filter((u) => accepted.has(u.row) && u.suggestion)
          .map((u) => fillLine(u.suggestion!, u.values)),
      ].slice(0, room)
    : [];

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={`${id}-t`}
      className="max-w-2xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <h2 id={`${id}-t`} className="text-sm font-semibold">
            {tr("Import the distributor's invoice")}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {tr(
              "CSV from the distributor (Marg, Retailio…) or Excel → Save as CSV. Lines are added to this purchase — check them, then save.",
            )}
          </p>
        </div>
        <DialogCloseButton onClick={onClose} />
      </div>

      <div className="max-h-[65vh] overflow-y-auto p-4 space-y-3 text-[11px]">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg text-[12px] gap-1.5"
            onClick={() =>
              downloadText("purchase_invoice_sample.csv", INVOICE_SAMPLE_CSV)
            }
          >
            <Download className="h-3.5 w-3.5" />
            {tr("Sample CSV")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg text-[12px] gap-1.5"
            onClick={() => input.current?.click()}
          >
            <FileUp className="h-3.5 w-3.5" />
            {tr("Choose file")}
          </Button>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            hidden
            aria-label={tr("Invoice file")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void read(f);
            }}
          />
        </div>
        {file ? (
          <p>
            {tr("File")}: <b>{file}</b>
          </p>
        ) : null}
        {error ? (
          <p className="text-red-500" role="alert">
            {error}
          </p>
        ) : null}

        {parsed ? (
          <>
            <p>
              <b className="text-emerald-600">
                {tr("{{n}} lines matched to your medicines", {
                  n: parsed.lines.length,
                })}
              </b>
              {parsed.invoiceNo ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {tr("Invoice")} {parsed.invoiceNo}
                  {parsed.invoiceDate ? ` · ${parsed.invoiceDate}` : ""}
                </span>
              ) : null}
            </p>

            {parsed.unmatched.length ? (
              <div className="rounded-lg border border-orange-300/60">
                <p className="border-b border-orange-300/60 bg-orange-50 px-3 py-1.5 font-semibold text-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
                  {tr(
                    "Not found in your medicines — pick the right one, or add it later",
                  )}
                </p>
                <ul className="divide-y divide-border/60">
                  {parsed.unmatched.map((u) => {
                    const on = accepted.has(u.row);
                    return (
                      <li
                        key={u.row}
                        className="flex items-center gap-3 px-3 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <span className="text-muted-foreground">
                            {tr("Row")} {u.row}:
                          </span>{" "}
                          <b>{u.name}</b>
                        </span>
                        {u.suggestion ? (
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              setAccepted((s) => {
                                const n = new Set(s);
                                if (on) n.delete(u.row);
                                else n.add(u.row);
                                return n;
                              })
                            }
                            className={cn(
                              "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
                              on
                                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "border-border hover:bg-muted",
                            )}
                          >
                            {on ? <Check className="h-3 w-3" /> : null}
                            {tr("Use {{name}}", { name: u.suggestion.name })}
                          </button>
                        ) : (
                          <span className="shrink-0 text-muted-foreground">
                            {tr("add the medicine first")}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {parsed.problems.length ? (
              <ul className="rounded-lg border border-border bg-muted/30 p-2 space-y-1 text-red-500">
                {parsed.problems.map((p) => (
                  <li key={p.row}>
                    {tr("Row")} {p.row}: {tr(p.message)}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-9 rounded-lg text-[12px]"
        >
          {tr("Cancel")}
        </Button>
        <Button
          type="button"
          disabled={lines.length === 0}
          onClick={() =>
            parsed &&
            onAdd(lines, {
              invoiceNo: parsed.invoiceNo,
              invoiceDate: parsed.invoiceDate,
            })
          }
          className="h-9 rounded-lg text-[12px]"
        >
          {lines.length
            ? tr("Add {{n}} lines", { n: lines.length })
            : tr("Add lines")}
        </Button>
      </div>
    </ModalShell>
  );
}
