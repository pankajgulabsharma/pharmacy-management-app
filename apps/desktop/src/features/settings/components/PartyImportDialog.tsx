import type { ShopPatch } from "@medicare/domain/shop/patch";
import { applyShopPatch } from "@/stores/applyShopPatch";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/common/ModalShell";
import { DialogCloseButton } from "@/components/common/DialogCloseButton";
import { apiRequest } from "@/lib/api";
import { RecentImports } from "@/features/imports/RecentImports";
import { useUndoImport } from "@/features/imports/useUndoImport";
import { downloadText } from "@/lib/csv";
import { tr } from "@/lib/i18n";
import { inrFromPaise } from "@medicare/domain/lib/money";
import {
  CUSTOMER_SAMPLE_CSV,
  SUPPLIER_SAMPLE_CSV,
  parseCustomerCsv,
  parseSupplierCsv,
  type Parsed,
} from "@medicare/domain/migrate/csv";

export type PartyKind = "customers" | "suppliers";

type ServerResult = {
  patch: ShopPatch;
  result: {
    importId: string;
    created: number;
    existing: number;
    errors: { row: number; name: string; error: string }[];
    openingPaise: number;
  };
};

/** What the preview needs from a customer / supplier row */
type Row = {
  name: string;
  openingBalancePaise?: number;
  openingDuePaise?: number;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

const TEXT = {
  customers: {
    title: "Import customers & old udhaar",
    help: "A CSV from your old software's party / outstanding list (Marg, Tally, GoFrugal… → Export → CSV) or the sample filled in Excel. Columns are found by name: name, mobile, address, credit limit, balance / old udhaar (“1,250 Dr” is fine).",
    balance: "old udhaar",
    sample: "customers_sample.csv",
  },
  suppliers: {
    title: "Import suppliers & old dues",
    help: "A CSV of your suppliers: name, GSTIN, DL no., mobile, city, credit days and balance / old dues. Each supplier's old dues become an “Old balance” you can pay off like any invoice — no stock, no GST.",
    balance: "old dues",
    sample: "suppliers_sample.csv",
  },
} as const;

/** Mounted only while open, so every import starts clean */
export function PartyImportDialog({
  kind,
  onClose,
}: {
  kind: PartyKind | null;
  onClose: () => void;
}) {
  if (!kind) return null;
  return <ImportForm kind={kind} onClose={onClose} />;
}

function ImportForm({
  kind,
  onClose,
}: {
  kind: PartyKind;
  onClose: () => void;
}) {
  const id = useId();
  const t = TEXT[kind];
  const undoImport = useUndoImport(kind);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<Parsed<Row> | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<ServerResult["result"] | null>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParsed(null);
    setDone(null);
    setError("");
    if (!/\.(csv|txt)$/i.test(file.name))
      return setError(tr("Please choose a .csv file"));
    if (file.size > MAX_FILE_BYTES)
      return setError(tr("File is larger than 5 MB"));
    try {
      const text = await file.text();
      const p =
        kind === "customers" ? parseCustomerCsv(text) : parseSupplierCsv(text);
      if (p.rows.length > MAX_ROWS)
        return setError(
          tr("Too many rows — max {{n}} per import", { n: MAX_ROWS }),
        );
      if (p.rows.length === 0)
        return setError(tr("No rows found in this file"));
      setParsed(p);
    } catch (e) {
      setError(
        e instanceof Error ? tr(e.message) : tr("Could not read this file"),
      );
    }
  };

  const doImport = async () => {
    if (!parsed || saving) return;
    setSaving(true);
    try {
      const r = await apiRequest<ServerResult>(
        "POST",
        `/api/${kind}/import`,
        { rows: parsed.rows },
        60_000,
      );
      applyShopPatch(r.patch); // shows at once (other counters get it live)
      setDone(r.result);
      toast.success(tr("{{n}} added", { n: r.result.created }), {
        ...(r.result.openingPaise
          ? {
              description: `${tr(t.balance)} ${inrFromPaise(r.result.openingPaise)}`,
            }
          : {}),
        // Wrong file? One click takes it back out
        ...(r.result.created > 0
          ? {
              duration: 15_000,
              action: {
                label: tr("Undo"),
                onClick: () => void undoImport(r.result.importId),
              },
            }
          : {}),
      });
    } catch (e) {
      toast.error(e instanceof Error ? tr(e.message) : tr("Could not import"));
    } finally {
      setSaving(false);
    }
  };

  const problems = [...(parsed?.problems ?? []), ...(done?.errors ?? [])];

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={`${id}-t`}
      className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 shrink-0">
        <h2 id={`${id}-t`} className="text-sm font-semibold">
          {tr(t.title)}
        </h2>
        <DialogCloseButton onClick={onClose} />
      </div>

      <div className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto text-[11px]">
        <p className="text-muted-foreground">{tr(t.help)}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg text-[12px] gap-1.5"
            onClick={() =>
              downloadText(
                t.sample,
                kind === "customers"
                  ? CUSTOMER_SAMPLE_CSV
                  : SUPPLIER_SAMPLE_CSV,
              )
            }
          >
            <Download className="h-3.5 w-3.5" />
            {tr("Sample CSV")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg text-[12px] gap-1.5"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {tr("Choose file")}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            aria-label={tr("CSV file")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void handleFile(f);
            }}
          />
        </div>

        {/* A wrong file can be taken back out (while none of them is used) */}
        {!parsed && !done ? <RecentImports kind={kind} /> : null}

        {error ? (
          <p className="text-red-500" role="alert">
            {error}
          </p>
        ) : null}
        {fileName ? (
          <p>
            {tr("File")}: <b>{fileName}</b>
          </p>
        ) : null}

        {parsed && !done ? (
          <div className="space-y-2">
            <p>
              <b className="text-emerald-600">
                {parsed.rows.length}{" "}
                {tr(kind === "customers" ? "customers" : "suppliers")}
              </b>
              {" · "}
              {tr(t.balance)} <b>{inrFromPaise(parsed.openingPaise)}</b>
            </p>
            <div className="rounded-lg border border-border overflow-auto max-h-48">
              <table className="w-full">
                <tbody>
                  {parsed.rows.slice(0, 8).map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-2 py-1 font-medium">{r.name}</td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {inrFromPaise(
                          r.openingBalancePaise ?? r.openingDuePaise ?? 0,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > 8 ? (
                <p className="px-2 py-1 text-muted-foreground">
                  {tr("…and {{n}} more", { n: parsed.rows.length - 8 })}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {done ? (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-800 dark:text-emerald-300">
            {tr("Added {{n}}", { n: done.created })} ·{" "}
            {tr("already here (skipped) {{n}}", { n: done.existing })} ·{" "}
            {tr(t.balance)} {inrFromPaise(done.openingPaise)}
          </p>
        ) : null}

        {problems.length > 0 ? (
          <ul className="max-h-32 overflow-auto rounded-lg border border-border bg-muted/30 p-2 space-y-1">
            {problems.map((p, i) => (
              <li key={i} className="text-amber-700 dark:text-amber-400">
                {tr("Row")} {p.row} · {p.name}: {tr(p.error)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="border-t border-border p-3 flex justify-end gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-lg text-[12px]"
          onClick={onClose}
        >
          {tr(done ? "Close" : "Cancel")}
        </Button>
        {!done ? (
          <Button
            type="button"
            disabled={!parsed || saving}
            className="h-9 rounded-lg text-[12px]"
            onClick={() => void doImport()}
          >
            {tr("Import")} {parsed ? parsed.rows.length : ""}
          </Button>
        ) : null}
      </div>
    </ModalShell>
  );
}
