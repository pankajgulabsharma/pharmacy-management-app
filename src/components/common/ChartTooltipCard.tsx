import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TooltipRow = {
  /** CSS colour of the marker */
  color: string;
  label: string;
  value: string;
  /** "dot" for bars/areas, "line" for line series */
  marker?: "dot" | "line";
};

type Props = {
  title: string;
  subtitle?: string;
  rows: readonly TooltipRow[];
  /** Small note under the values, e.g. "+12% vs average" */
  note?: { text: string; tone?: "good" | "bad" | "muted" };
  footer?: ReactNode;
};

/**
 * Chart hover card: title, aligned label/value rows, optional note and
 * footer. One design for every chart in the app.
 */
export function ChartTooltipCard({
  title,
  subtitle,
  rows,
  note,
  footer,
}: Props) {
  return (
    <div className="min-w-[176px] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-[0_8px_24px_-6px_rgb(15_23_42/0.18)]">
      <div className="border-b border-border/70 px-3.5 pt-2.5 pb-2">
        <p className="text-[11px] font-semibold tracking-wide text-foreground leading-tight">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-1 text-[10px] leading-none text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="space-y-2 px-3.5 py-2.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[12px_1fr_auto] items-center gap-2.5 text-[12px] leading-tight"
          >
            {r.marker === "line" ? (
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ backgroundColor: r.color }}
              />
            ) : (
              <span
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ backgroundColor: r.color }}
              />
            )}
            <span className="text-muted-foreground">{r.label}</span>
            <span className="pl-4 text-right font-semibold tabular-nums text-foreground">
              {r.value}
            </span>
          </div>
        ))}
        {note ? (
          <p
            className={cn(
              "pt-1 text-[10px] font-medium leading-none",
              note.tone === "good" && "text-emerald-600 dark:text-emerald-400",
              note.tone === "bad" && "text-red-500",
              (!note.tone || note.tone === "muted") && "text-muted-foreground",
            )}
          >
            {note.text}
          </p>
        ) : null}
      </div>
      {footer ? (
        <div className="border-t border-border/70 px-3 py-1.5 text-[10px] leading-none text-primary">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
