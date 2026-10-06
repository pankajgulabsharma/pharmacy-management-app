import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

/** The "X" in a dialog's top-right corner (Esc does the same) */
export function DialogCloseButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tr("Close")}
      title={`${tr("Close")} (Esc)`}
      className={cn(
        "h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-muted-foreground",
        "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <X className="h-4 w-4" />
    </button>
  );
}
