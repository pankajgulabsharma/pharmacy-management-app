import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, X } from "lucide-react";
import { rackLabel } from "@medicare/domain/inventory/stockCount";
import { ModalShell } from "@/components/common/ModalShell";
import { fieldClass } from "@/components/common/formStyles";
import { Button } from "@/components/ui/button";
import { useInventoryRows } from "@/features/inventory/hooks/useInventoryRows";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useStockCountStore } from "./useStockCountStore";

/**
 * Start a count: which racks (none picked = the whole shop), and whether
 * empty batches are listed too (to catch stock the app thinks is gone).
 */
export function StartCountDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const racks = useStockCountStore((s) => s.racks);
  const start = useStockCountStore((s) => s.start);
  const rows = useInventoryRows();
  const [picked, setPicked] = useState<string[]>([]);
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Batches per rack, as the count will list them
  const perRack = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of rows)
      if (includeEmpty || b.qtyStrip > 0 || b.qtyLoose > 0)
        m.set(b.rack.trim(), (m.get(b.rack.trim()) ?? 0) + 1);
    return m;
  }, [rows, includeEmpty]);
  const total = picked.length
    ? picked.reduce((n, r) => n + (perRack.get(r) ?? 0), 0)
    : [...perRack.values()].reduce((a, b) => a + b, 0);

  if (!open) return null;
  const toggle = (r: string) =>
    setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));

  const go = async () => {
    setBusy(true);
    try {
      const c = await start({ racks: picked, includeEmpty, note: note.trim() });
      toast.success(tr("{{no}} started", { no: c.countNo }));
      setPicked([]);
      setNote("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Could not start"));
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean) =>
    cn(
      "h-7 rounded-md border px-2.5 text-[11px] tabular-nums transition-colors",
      on
        ? "border-primary bg-primary/10 font-medium text-primary"
        : "border-border bg-muted/30 text-foreground hover:bg-muted",
    );

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="max-w-lg"
    >
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold">
              {tr("Start a stock count")}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {tr(
                "Pick the racks to count today. Billing goes on as usual while you count.",
              )}
            </p>
          </div>
          <button
            type="button"
            aria-label={tr("Close")}
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-medium">{tr("Racks")}</span>
            <span className="text-[10.5px] text-muted-foreground">
              {picked.length
                ? tr("{{n}} racks picked", { n: picked.length })
                : tr("None picked = whole shop")}
            </span>
          </div>
          <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
            <button
              type="button"
              aria-pressed={!picked.length}
              onClick={() => setPicked([])}
              className={chip(!picked.length)}
            >
              {tr("All racks")}
            </button>
            {racks.map((r) => (
              <button
                key={r || "-"}
                type="button"
                aria-pressed={picked.includes(r)}
                onClick={() => toggle(r)}
                className={chip(picked.includes(r))}
              >
                {tr(rackLabel(r))}
                <span className="ml-1 text-muted-foreground">
                  {perRack.get(r) ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={includeEmpty}
            onChange={(e) => setIncludeEmpty(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--primary)]"
          />
          {tr("Also list batches the app shows as empty")}
        </label>

        <label className="block">
          <span className="mb-1 block text-[10.5px] text-muted-foreground">
            {tr("Note (optional)")}
          </span>
          <input
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
            placeholder={tr("e.g. Month-end count")}
            className={cn(fieldClass, "h-8")}
          />
        </label>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-[11px] text-muted-foreground">
            {tr("{{n}} batches to count", { n: total })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 text-[11px]"
            >
              {tr("Cancel")}
            </Button>
            <Button
              size="sm"
              data-autofocus
              disabled={busy || total === 0}
              onClick={() => void go()}
              className="h-8 text-[11px]"
            >
              {tr("Start count")}
            </Button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
