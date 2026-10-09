import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTr } from "@/hooks/useTr";

export type ReportColumn<T> = {
  key: string;
  label: string;
  align?: "left" | "right";
  /** Tailwind width class, e.g. "w-[96px]" (omit for the flexible column) */
  width?: string;
  render: (row: T) => ReactNode;
};

type Props<T> = {
  title: string;
  subtitle?: string;
  rows: readonly T[];
  columns: readonly ReportColumn<T>[];
  getKey: (row: T) => string;
  /** Optional totals row, one cell per column */
  footer?: ReactNode[];
  empty: string;
  maxHeightClass?: string;
  /** Button(s) in the card header, e.g. Export */
  action?: ReactNode;
};

/** Read-only report table — same indigo header style as every other table */
export function ReportTable<T>({
  title,
  subtitle,
  rows,
  columns,
  getKey,
  footer,
  empty,
  maxHeightClass = "max-h-[340px]",
  action,
}: Props<T>) {
  const tr = useTr();
  return (
    <ReportCard title={title} subtitle={subtitle} action={action} flush>
      {rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-[11px] text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className={cn("overflow-auto", maxHeightClass)}>
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      "h-9 px-3 bg-primary text-primary-foreground",
                      "text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap",
                      c.align === "right" ? "text-right" : "text-left",
                      c.width,
                    )}
                  >
                    {tr(c.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={getKey(r)}
                  className={cn(
                    "border-b border-border/60 last:border-0 hover:bg-muted/40",
                    i % 2 === 1 && "bg-muted/20",
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-3 py-2 align-middle",
                        c.align === "right" && "text-right tabular-nums",
                      )}
                    >
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer ? (
              <tfoot className="sticky bottom-0 z-10">
                <tr className="border-t-2 border-border bg-muted font-semibold">
                  {footer.map((cell, i) => (
                    <td
                      key={i}
                      className={cn(
                        "px-3 py-2",
                        columns[i]?.align === "right" &&
                          "text-right tabular-nums",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </ReportCard>
  );
}

/** Card with a title row; `flush` removes inner padding (for tables) */
export function ReportCard({
  title,
  subtitle,
  action,
  flush,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const tr = useTr();
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden flex flex-col min-w-0",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2 px-3 py-2.5 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-[12px] font-semibold text-foreground">
            {tr(title)}
          </h3>
          {subtitle ? (
            <p className="text-[10px] text-muted-foreground truncate">
              {tr(subtitle)}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className={cn("flex-1 min-h-0", !flush && "p-3")}>{children}</div>
    </section>
  );
}

/** Thin horizontal bar showing a share of the largest value */
export function ShareBar({
  value,
  max,
  tone = "primary",
}: {
  value: number;
  max: number;
  tone?: "primary" | "red" | "orange";
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
      aria-hidden="true"
    >
      <div
        className={cn(
          "h-full rounded-full",
          tone === "red"
            ? "bg-red-500"
            : tone === "orange"
              ? "bg-orange-500"
              : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
