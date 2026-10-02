import { useId, useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/common/ModalShell";
import type { Medicine } from "../types";
import {
  buildSampleCsv,
  parseMedicineCsv,
  type CsvRowResult,
} from "../utils/csv";

type Props = {
  open: boolean;
  onClose: () => void;
  onImport: (
    rows: Omit<
      Medicine,
      "id" | "stockStrip" | "stockLoose" | "nearestExpiry"
    >[],
  ) => void;
};

/** Guard rails so a wrong/huge file can't freeze the browser */
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_ROWS = 5000;

/** Mounted only while open, so every import starts clean */
export function MedicineImportDialog({ open, onClose, onImport }: Props) {
  if (!open) return null;
  return <ImportForm onClose={onClose} onImport={onImport} />;
}

function ImportForm({ onClose, onImport }: Omit<Props, "open">) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<CsvRowResult[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");

  const okRows = results?.filter((r) => r.ok) ?? [];
  const errRows = results?.filter((r) => !r.ok) ?? [];

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResults(null);
    setFileError("");

    const isCsv =
      file.name.toLowerCase().endsWith(".csv") ||
      file.type === "text/csv" ||
      file.type === "application/vnd.ms-excel";
    if (!isCsv) {
      setFileError("Please choose a .csv file");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("File is larger than 2 MB");
      return;
    }

    const text = await file.text();
    const parsed = parseMedicineCsv(text);
    if (parsed.length > MAX_ROWS) {
      setFileError(`Too many rows — max ${MAX_ROWS} per import`);
      return;
    }
    setResults(parsed);
  };

  const downloadSample = () => {
    const blob = new Blob([buildSampleCsv()], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "medicines_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const data = okRows
      .filter((r): r is Extract<CsvRowResult, { ok: true }> => r.ok)
      .map((r) => r.data);
    if (data.length === 0) return;
    onImport(data);
    setResults(null);
    setFileName("");
    onClose();
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <h2 id={titleId} className="text-sm font-semibold">
          Import medicines (CSV)
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto">
        <p className="text-[11px] text-muted-foreground">
          Upload CSV with columns: name, salt, brand, category, hsn, barcode,
          rack, unit (STP/BTL/LSE), units_per_strip, allow_loose, mrp,
          sale_price, min_stock, status.
        </p>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg text-[12px] gap-1.5"
            onClick={downloadSample}
          >
            <Download className="h-3.5 w-3.5" />
            Sample CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg text-[12px] gap-1.5"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Choose file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
        </div>

        {fileError ? (
          <p className="text-[11px] text-red-500" role="alert">
            {fileError}
          </p>
        ) : null}

        {fileName ? (
          <p className="text-[11px] text-foreground">
            File: <span className="font-medium">{fileName}</span>
          </p>
        ) : null}

        {results && (
          <div className="space-y-2 text-[11px]">
            <p>
              <span className="text-emerald-600 font-medium">
                {okRows.length} valid
              </span>
              {" · "}
              <span className="text-red-500 font-medium">
                {errRows.length} errors
              </span>
            </p>
            {errRows.length > 0 && (
              <ul className="max-h-28 overflow-auto rounded-lg border border-border bg-muted/30 p-2 space-y-1">
                {errRows.map((r, i) =>
                  !r.ok ? (
                    <li key={i} className="text-red-500">
                      Row {r.row}: {r.message}
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3 flex justify-end gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-lg text-[12px]"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={okRows.length === 0}
          className="h-9 rounded-lg text-[12px]"
          onClick={handleImport}
        >
          Import {okRows.length > 0 ? `${okRows.length} rows` : ""}
        </Button>
      </div>
    </ModalShell>
  );
}
