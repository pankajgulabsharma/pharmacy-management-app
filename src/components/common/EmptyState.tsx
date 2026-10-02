import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Smaller icon and spacing for tight panels (billing, side widgets) */
  compact?: boolean;
  /** Draw the card border/background (off when placed inside another card) */
  bordered?: boolean;
  className?: string;
};

/** "Nothing here yet" block that tells the user what to do next */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  bordered = true,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex-1 min-h-0 flex flex-col items-center justify-center text-center px-4",
        compact ? "gap-1.5 py-6" : "gap-2 py-10",
        bordered && "rounded-lg border border-border bg-card",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-full bg-muted flex items-center justify-center",
          compact ? "h-8 w-8" : "h-10 w-10",
        )}
      >
        <Icon
          className={cn(
            "text-muted-foreground",
            compact ? "h-4 w-4" : "h-5 w-5",
          )}
        />
      </div>
      <p
        className={cn(
          "font-medium text-foreground",
          compact ? "text-[11px]" : "text-xs",
        )}
      >
        {title}
      </p>
      {description ? (
        <p
          className={cn(
            "text-muted-foreground max-w-xs",
            compact ? "text-[10px]" : "text-[11px]",
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
