import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Props<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Shown at the end when some items don't fit, e.g. "+3 more" */
  renderMore: (hiddenCount: number) => ReactNode;
  gap?: number;
};

/**
 * One line of chips that never wraps and never cuts a chip in half:
 * it measures the chips, shows as many as fully fit, and replaces the
 * rest with a "+N more" chip. A wider screen automatically shows more.
 */
export function FitRow<T>({
  items,
  getKey,
  renderItem,
  renderMore,
  gap = 6,
}: Props<T>) {
  const boxRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(items.length);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure) return;

    const fit = () => {
      const widths = Array.from(measure.children).map(
        (c) => (c as HTMLElement).offsetWidth,
      );
      const moreW = moreRef.current?.offsetWidth ?? 70;
      const avail = box.clientWidth;
      let used = 0;
      let count = 0;
      for (let i = 0; i < widths.length; i++) {
        const next = used + (i > 0 ? gap : 0) + widths[i];
        const needMore = i < widths.length - 1; // will a "+N" chip still be needed?
        if (next + (needMore ? gap + moreW : 0) > avail) break;
        used = next;
        count++;
      }
      setVisible(count);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [items, gap]);

  const hidden = items.length - visible;

  return (
    <div ref={boxRef} className="relative min-w-0 overflow-hidden">
      {/* Off-screen copy used only to measure natural chip widths */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="invisible absolute left-0 top-0 flex whitespace-nowrap pointer-events-none"
        style={{ gap }}
      >
        {items.map((it) => (
          <div key={getKey(it)} className="shrink-0">
            {renderItem(it)}
          </div>
        ))}
      </div>
      <div
        ref={moreRef}
        aria-hidden="true"
        className="invisible absolute left-0 top-0 pointer-events-none"
      >
        {renderMore(99)}
      </div>

      <div className="flex flex-nowrap items-center" style={{ gap }}>
        {items.slice(0, visible).map((it) => (
          <div key={getKey(it)} className="shrink-0">
            {renderItem(it)}
          </div>
        ))}
        {hidden > 0 ? (
          <div className="shrink-0">{renderMore(hidden)}</div>
        ) : null}
      </div>
    </div>
  );
}
