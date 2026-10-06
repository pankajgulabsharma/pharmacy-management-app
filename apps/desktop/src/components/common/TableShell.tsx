import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { useTr } from "@/hooks/useTr";

export type TableColumn = {
  key: string;
  label: string;
  /**
   * Tailwind width class, e.g. "w-[104px]". Omit it on exactly one column
   * (usually the name) — that column takes all the remaining width.
   */
  width?: string;
  align?: "text-left" | "text-right" | "text-center";
};

/** Must match the header height below (h-9) — used by useVirtualRows */
export const TABLE_HEADER_HEIGHT = 36;

type Props = {
  columns: readonly TableColumn[];
  /** Tailwind min-width class so columns scroll sideways instead of squashing */
  minWidthClass?: string;
  /** Pass useVirtualRows().scrollRef when the table is virtualized */
  scrollRef?: Ref<HTMLDivElement>;
  /** Optional sticky summary bar under the table */
  footer?: ReactNode;
  /** Cell padding for header labels */
  headerCellClass?: string;
  children: ReactNode;
};

/**
 * Card + scroll area + fixed-layout table with a sticky indigo header.
 * Shared by Inventory, Purchases and the purchase line editor.
 */
export function TableShell({
  columns,
  minWidthClass = "min-w-[1100px]",
  scrollRef,
  footer,
  headerCellClass = "px-3",
  children,
}: Props) {
  const tr = useTr();
  return (
    <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
        <table
          className={cn(
            "w-full table-fixed border-collapse text-[11px]",
            minWidthClass,
          )}
        >
          {/*
            Fixed columns keep their exact width; the one column without a
            width gets "w-full", so it absorbs ALL spare space. Without this
            the browser spreads spare space over every column and small
            columns (e.g. "Credit") end up with large empty gaps.
          */}
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} className={c.width ?? "w-full"} />
            ))}
          </colgroup>

          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "h-9 bg-primary text-primary-foreground",
                    "text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap",
                    headerCellClass,
                    c.align ?? "text-left",
                  )}
                >
                  {tr(c.label)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>{children}</tbody>
        </table>
      </div>

      {footer ? (
        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** Empty row that reserves height for off-screen virtualized rows */
export function SpacerRow({
  height,
  colSpan,
}: {
  height: number;
  colSpan: number;
}) {
  if (height <= 0) return null;
  return (
    <tr aria-hidden="true">
      <td colSpan={colSpan} style={{ height }} />
    </tr>
  );
}
