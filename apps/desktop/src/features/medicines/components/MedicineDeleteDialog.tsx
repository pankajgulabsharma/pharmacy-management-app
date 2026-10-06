import { useId } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { Button } from "@/components/ui/button";
import type { MedicineWithStock } from "@medicare/domain/medicines/types";

type Props = {
  open: boolean;
  medicine: MedicineWithStock | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
};

export function MedicineDeleteDialog({
  open,
  medicine,
  onClose,
  onConfirm,
}: Props) {
  const titleId = useId();
  const descId = useId();

  if (!open || !medicine) return null;

  const hasStock = medicine.stockStrip > 0 || medicine.stockLoose > 0;

  return (
    <ModalShell
      open
      onClose={onClose}
      role="alertdialog"
      labelledBy={titleId}
      describedBy={descId}
      className="max-w-md"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center">
            <Trash2 className="h-4 w-4" />
          </div>
          <h2 id={titleId} className="text-sm font-semibold text-foreground">
            Delete medicine
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-3">
        <p id={descId} className="text-[13px] text-foreground">
          Delete <span className="font-semibold">{medicine.name}</span>
          {medicine.brand ? (
            <span className="text-muted-foreground"> ({medicine.brand})</span>
          ) : null}
          ? This cannot be undone in the current list.
        </p>

        {hasStock && (
          <div className="flex gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
            <div className="text-[12px] text-foreground leading-snug">
              <p className="font-medium text-orange-700 dark:text-orange-400">
                Can't delete — stock still available
              </p>
              <p className="text-muted-foreground mt-0.5">
                Current stock:{" "}
                <span className="font-medium text-foreground">
                  {medicine.stockStrip} {medicine.unit}
                  {medicine.stockLoose > 0
                    ? ` + ${medicine.stockLoose} LSE`
                    : ""}
                </span>
              </p>
              <p className="text-muted-foreground mt-1">
                Deleting it would leave {medicine.batchCount} batch
                {medicine.batchCount === 1 ? "" : "es"} without a product. Set
                the medicine to <b>Inactive</b> instead, or sell / adjust the
                stock to zero first.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-lg text-[12px]"
          onClick={onClose}
          data-autofocus
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="h-9 rounded-lg text-[12px] bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          disabled={hasStock}
          onClick={() => onConfirm(medicine.id)}
        >
          Delete permanently
        </Button>
      </div>
    </ModalShell>
  );
}
