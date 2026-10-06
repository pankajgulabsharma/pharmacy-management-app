import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTr } from "@/hooks/useTr";

type Props = {
  icon: LucideIcon;
  /** Accessible name, e.g. "Adjust stock for Dolo 650 (DL001)" */
  label: string;
  /** Short tooltip */
  title?: string;
  tone?: "default" | "danger";
  onClick: () => void;
};

/** Small icon button for the actions column of a table row */
export const RowActionButton = memo(function RowActionButton({
  icon: Icon,
  label,
  title,
  tone = "default",
  onClick,
}: Props) {
  const tr = useTr();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tr(label)}
      title={tr(title ?? label)}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent",
        "text-muted-foreground transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        tone === "danger"
          ? "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
          : "hover:border-border hover:bg-background hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
});
