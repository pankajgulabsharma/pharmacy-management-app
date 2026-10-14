import { useEffect, useRef, type ReactNode } from "react";
import { BookOpen, Plus } from "lucide-react";
import {
  LIBRARY_CREDIT,
  type LibraryItem,
} from "@medicare/domain/medicines/library";
import { formatPaise } from "@medicare/domain/lib/money";
import { scrollRowIntoView } from "@/lib/dom";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

type Props = {
  items: readonly LibraryItem[];
  /** Row picked (click / Enter). Without it the rows are only shown. */
  onPick?: (item: LibraryItem) => void;
  /** Right-hand action of a row (default: "+ Add") */
  action?: (item: LibraryItem) => ReactNode;
  /** Rows that can't be picked (shown dimmed, no click) */
  canPick?: (item: LibraryItem) => boolean;
  /** Highlighted row (keyboard), -1 = none */
  activeIndex?: number;
  onHover?: (i: number) => void;
  /** List id; rows get `<id>-<offset + n>` (aria-activedescendant) */
  idPrefix?: string;
  /** Rows above this list in the same keyboard list (e.g. own medicines) */
  indexOffset?: number;
  title?: string;
  hint?: string;
  className?: string;
};

/**
 * Medicines from the Medicine Library (not in this shop yet). Prices are
 * from 2022 — shown only as a guide.
 */
export function LibraryList({
  items,
  onPick,
  action,
  canPick = () => true,
  activeIndex = -1,
  onHover,
  idPrefix,
  indexOffset = 0,
  title = "Not in your medicines — from the Medicine Library",
  hint,
  className,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  // ↑ ↓ keep the highlighted row on screen
  useEffect(() => {
    if (activeIndex >= 0)
      scrollRowIntoView(
        listRef.current?.querySelector<HTMLElement>(
          `[data-lib-row="${activeIndex}"]`,
        ) ?? null,
      );
  }, [activeIndex]);

  if (items.length === 0) return null;
  return (
    <div className={className}>
      <div className="px-3 pt-2.5 pb-1.5 flex items-start gap-2 border-b border-border/60 bg-muted/30">
        <span className="mt-0.5 h-5 w-5 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <BookOpen className="h-3 w-3" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-foreground">
            {tr(title)}
          </p>
          {hint ? (
            <p className="text-[10px] text-muted-foreground">{tr(hint)}</p>
          ) : null}
        </div>
      </div>
      <ul
        ref={listRef}
        id={idPrefix && indexOffset === 0 ? idPrefix : undefined}
        role="listbox"
        aria-label={tr("Medicine Library")}
        className="py-1"
      >
        {items.map((x, i) => {
          const pickable = !!onPick && canPick(x);
          const active = i === activeIndex;
          return (
            <li
              key={x.id}
              data-lib-row={i}
              id={idPrefix ? `${idPrefix}-${indexOffset + i}` : undefined}
              role="option"
              aria-selected={active}
              aria-disabled={!pickable || undefined}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => onHover?.(i)}
              onClick={pickable ? () => onPick(x) : undefined}
              className={cn(
                "mx-1 px-2.5 py-2 rounded-md flex items-center gap-3 border-l-2",
                pickable && "cursor-pointer",
                active
                  ? "bg-primary/[0.07] border-primary"
                  : cn("border-transparent", pickable && "hover:bg-muted/60"),
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-[12px] font-medium text-foreground truncate">
                    {x.name}
                  </p>
                  {x.pack ? (
                    <span className="shrink-0 rounded border border-border bg-background px-1.5 py-px text-[9px] text-muted-foreground">
                      {x.pack}
                    </span>
                  ) : null}
                </div>
                <p className="text-[10px] truncate mt-0.5">
                  <span className="text-foreground/80">{x.salt || "—"}</span>
                  {x.company ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {x.company}
                    </span>
                  ) : null}
                </p>
              </div>
              {x.mrpPaise > 0 ? (
                <div
                  className="text-right shrink-0"
                  title={tr("Price in 2022 — check the pack")}
                >
                  <p className="text-[11px] tabular-nums text-foreground">
                    ₹{formatPaise(x.mrpPaise)}
                  </p>
                </div>
              ) : null}
              <div className="shrink-0 min-w-[64px] flex justify-end whitespace-nowrap">
                {action ? (
                  action(x)
                ) : onPick ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                    <Plus className="h-3 w-3" />
                    {tr("Add")}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="px-3 pb-1.5 text-[9px] text-muted-foreground/80">
        {LIBRARY_CREDIT}
      </p>
    </div>
  );
}
