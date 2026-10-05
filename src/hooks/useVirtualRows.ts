import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TABLE_HEADER_HEIGHT } from "@/components/common/TableShell";

type Options<T> = {
  items: readonly T[];
  /** Must be a stable function (module-level or memoized) */
  getKey: (item: T) => string;
  /** Approximate row height in px; real heights are measured after render */
  estimateSize?: number;
  /** Height of the sticky <thead> above the rows */
  headerHeight?: number;
  overscan?: number;
};

/**
 * Virtualizes <tbody> rows of a scrollable table using spacer rows,
 * so only the visible rows (+ overscan) are in the DOM.
 *
 * Usage with TableShell:
 *   const v = useVirtualRows({ items, getKey });
 *   <TableShell columns={COLUMNS} scrollRef={v.scrollRef}>
 *     <SpacerRow height={v.paddingTop} colSpan={COLUMNS.length} />
 *     {v.virtualRows.map(r => <Row ref={v.measureElement} data-index={r.index} … />)}
 *     <SpacerRow height={v.paddingBottom} colSpan={COLUMNS.length} />
 *   </TableShell>
 */
export function useVirtualRows<T>({
  items,
  getKey,
  estimateSize = 52,
  headerHeight = TABLE_HEADER_HEIGHT,
  overscan = 10,
}: Options<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // React Compiler is not enabled in this project, so its warning about
  // TanStack Virtual does not apply.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin: headerHeight,
    // Rows scrolled to with the keyboard stop BELOW the sticky header,
    // with a little air at the bottom too
    // +6 px: the header's bottom border, plus a little air above the row
    scrollPaddingStart: headerHeight + 6,
    scrollPaddingEnd: 8,
    getItemKey: (index) => getKey(items[index]),
  });

  const virtualRows = virtualizer.getVirtualItems();
  const first = virtualRows[0];
  const last = virtualRows[virtualRows.length - 1];

  const paddingTop = first ? first.start - headerHeight : 0;
  const paddingBottom = last
    ? virtualizer.getTotalSize() - (last.end - headerHeight)
    : 0;

  return {
    scrollRef,
    virtualRows,
    paddingTop,
    paddingBottom,
    measureElement: virtualizer.measureElement,
    /** Bring a row into view (keyboard selection) */
    scrollToIndex: (index: number) =>
      virtualizer.scrollToIndex(index, { align: "auto" }),
  };
}
