import { useId, type ReactNode } from "react";
import { AlertTriangle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ModalShell } from "./ModalShell";

type Props = {
  open: boolean;
  title: string;
  /** Plain-language consequence, e.g. "Stock will be removed from inventory." */
  description: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "default";
  icon?: LucideIcon;
  /** Extra inputs (reason, notes…) */
  children?: ReactNode;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Confirmation for destructive or irreversible actions. Focus starts on
 * Cancel (safe default) and Esc closes, via ModalShell.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "danger",
  icon: Icon = AlertTriangle,
  children,
  confirmDisabled,
  onConfirm,
  onClose,
}: Props) {
  const titleId = useId();
  const descId = useId();
  if (!open) return null;

  const danger = tone === "danger";

  return (
    <ModalShell
      open
      onClose={onClose}
      role="alertdialog"
      labelledBy={titleId}
      describedBy={descId}
      className="max-w-md"
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
              danger
                ? "bg-red-500/10 text-red-600"
                : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-semibold text-foreground">
              {title}
            </h2>
            <div
              id={descId}
              className="mt-1 text-[12px] text-muted-foreground leading-snug"
            >
              {description}
            </div>
          </div>
        </div>
        {children}
      </div>

      <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-lg text-[12px]"
          onClick={onClose}
          data-autofocus
        >
          Keep it
        </Button>
        <Button
          type="button"
          disabled={confirmDisabled}
          onClick={onConfirm}
          data-primary
          className={cn(
            "h-9 rounded-lg text-[12px] disabled:opacity-50",
            danger && "bg-red-600 hover:bg-red-700 text-white",
          )}
        >
          {confirmLabel}
        </Button>
      </div>
    </ModalShell>
  );
}
