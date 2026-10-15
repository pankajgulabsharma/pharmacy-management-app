import { useCallback, useEffect, useState } from "react";
import { History, Undo2 } from "lucide-react";
import { apiGet } from "@/lib/api";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useUndoImport } from "../hooks/useUndoImport";

type MedicineImport = {
  id: string;
  at: string;
  rows: number;
  created: number;
  existing: number;
  batches: number;
  undoneAt: string;
};

const when = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Last imports with an Undo — for a wrong file (wrong shop's export,
 * prices in the wrong column…). Undo works while nothing from the file
 * has been sold, purchased or adjusted; otherwise the server says which
 * medicine is in use.
 */
export function RecentImports() {
  const [items, setItems] = useState<MedicineImport[] | null>(null);
  const [asking, setAsking] = useState<MedicineImport | null>(null);
  const load = useCallback(() => {
    apiGet<{ imports: MedicineImport[] }>("/api/medicines/imports")
      .then((r) => setItems(r.imports))
      .catch(() => setItems([]));
  }, []);
  useEffect(load, [load]);
  const undo = useUndoImport(load);

  if (!items?.length) return null;
  return (
    <div className="rounded-lg border border-border">
      <p className="flex items-center gap-1.5 border-b border-border bg-muted/30 px-3 py-1.5 text-[11px] font-semibold">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        {tr("Recent imports")}
      </p>
      <ul className="divide-y divide-border/60">
        {items.slice(0, 5).map((x) => (
          <li
            key={x.id}
            className="flex items-center gap-3 px-3 py-1.5 text-[11px]"
          >
            <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
              {when.format(new Date(x.at))}
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                x.undoneAt && "text-muted-foreground line-through",
              )}
            >
              {tr("{{rows}} rows · {{created}} new · {{batches}} batches", {
                rows: x.rows,
                created: x.created,
                batches: x.batches,
              })}
            </span>
            {x.undoneAt ? (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {tr("Undone")}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setAsking(x)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium hover:bg-muted"
              >
                <Undo2 className="h-3 w-3" />
                {tr("Undo")}
              </button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={asking !== null}
        title={tr("Undo this import?")}
        description={tr(
          "The {{created}} new medicines it added are deleted, and the opening stock it added is taken out. Medicines that were already in your list stay. Not possible once anything from it is sold, purchased or adjusted.",
          { created: asking?.created ?? 0 },
        )}
        confirmLabel={tr("Undo import")}
        tone="danger"
        icon={Undo2}
        onConfirm={() => {
          const id = asking?.id;
          setAsking(null);
          if (id) void undo(id);
        }}
        onClose={() => setAsking(null)}
      />
    </div>
  );
}
