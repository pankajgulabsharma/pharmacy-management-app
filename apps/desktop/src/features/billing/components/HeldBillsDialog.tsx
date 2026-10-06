import { useId } from "react";
import { PauseCircle, Play, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/common/ModalShell";
import { EmptyState } from "@/components/common/EmptyState";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import type { HeldBill } from "@medicare/domain/billing/types";
import { tr } from "@/lib/i18n";

type Props = {
  open: boolean;
  held: HeldBill[];
  /** Current cart has items — resuming will replace it */
  cartHasItems: boolean;
  onResume: (id: string) => void;
  onDiscard: (id: string) => void;
  onClose: () => void;
};

/** Parked bills. Stock is re-checked when a bill is resumed. */
export function HeldBillsDialog({
  open,
  held,
  cartHasItems,
  onResume,
  onDiscard,
  onClose,
}: Props) {
  const titleId = useId();
  const medicines = useMedicineStore((s) => s.medicines);
  if (!open) return null;
  const nameOf = (id: string) =>
    medicines.find((m) => m.id === id)?.name ?? "Unknown";

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <PauseCircle className="h-4 w-4 text-amber-600" />
          <h2 id={titleId} className="text-sm font-semibold">
            Held bills ({held.length})
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
        {held.length === 0 ? (
          <EmptyState
            icon={PauseCircle}
            title="No held bills"
            description="Use “Hold bill” to park a customer and serve the next one."
          />
        ) : (
          held.map((h) => (
            <div key={h.id} className="rounded-lg border border-border p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-foreground truncate">
                    {h.customerName || "Walk-in customer"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(h.heldAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {h.counter} · {h.lines.length} item
                    {h.lines.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {h.lines.map((l) => nameOf(l.medicineId)).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    className="h-7 rounded-md text-[10px] gap-1 px-2"
                    onClick={() => onResume(h.id)}
                  >
                    <Play className="h-3 w-3" />
                    {tr("Resume")}
                  </Button>
                  <button
                    type="button"
                    onClick={() => onDiscard(h.id)}
                    aria-label={`Discard held bill for ${h.customerName || "walk-in"}`}
                    title="Discard"
                    className="h-7 w-7 rounded-md flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {cartHasItems && held.length > 0 ? (
        <p className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground shrink-0">
          {tr(
            "Resuming will hold your current bill first, so nothing is lost.",
          )}
        </p>
      ) : null}
    </ModalShell>
  );
}
