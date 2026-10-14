import { BookOpen, Plus } from "lucide-react";
import {
  LIBRARY_CREDIT,
  type LibraryItem,
} from "@medicare/domain/medicines/library";
import { formatPaise } from "@medicare/domain/lib/money";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

type Props = {
  items: readonly LibraryItem[];
  /** Picked row → fill the medicine form (hidden when the user can't add) */
  onPick?: (item: LibraryItem) => void;
  /** What picking does (default "Add") */
  actionLabel?: string;
  activeIndex?: number;
  onHover?: (i: number) => void;
  /** List id; rows get `<id>-<n>` (for aria-controls / activedescendant) */
  idPrefix?: string;
  className?: string;
};

/**
 * Medicines from the Medicine Library (not in this shop yet). Prices are
 * from 2022 — shown only as a guide.
 */
export function LibraryList({
  items,
  onPick,
  actionLabel = "Add",
  activeIndex = -1,
  onHover,
  idPrefix,
  className,
}: Props) {
  if (items.length === 0) return null;
  return (
    <div className={className}>
      <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <BookOpen className="h-3 w-3" />
        {tr("Not in your medicines — from the Medicine Library")}
      </p>
      <ul id={idPrefix} role="listbox" aria-label={tr("Medicine Library")}>
        {items.map((x, i) => (
          <li
            key={x.id}
            id={idPrefix ? `${idPrefix}-${i}` : undefined}
            role="option"
            aria-selected={i === activeIndex}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onHover?.(i)}
            onClick={onPick ? () => onPick(x) : undefined}
            className={cn(
              "px-3 py-1.5 flex items-center gap-3",
              onPick && "cursor-pointer",
              i === activeIndex ? "bg-muted" : onPick && "hover:bg-muted/60",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-foreground truncate">
                {x.name}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {x.salt || "—"} · {x.company} · {x.pack}
              </p>
            </div>
            {x.mrpPaise > 0 ? (
              <p
                className="text-[10px] tabular-nums text-muted-foreground shrink-0"
                title={tr("Price in 2022 — check the pack")}
              >
                ~₹{formatPaise(x.mrpPaise)}
              </p>
            ) : null}
            {onPick ? (
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                <Plus className="h-3 w-3" />
                {tr(actionLabel)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="px-3 py-1 text-[9px] text-muted-foreground/80">
        {LIBRARY_CREDIT}
      </p>
    </div>
  );
}
