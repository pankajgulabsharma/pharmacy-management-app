import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { DIFF_TOLERANCE_PAISE } from "@medicare/domain/cash/galla";
import { fieldClass } from "@/components/common/formStyles";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** A card of the galla screen — same density as the rest of the app */
export function Panel({
  icon: Icon,
  title,
  hint,
  actions,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-xl border border-border bg-card",
        className,
      )}
    >
      <header className="flex min-h-[48px] items-center gap-2.5 border-b border-border px-4 py-2">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[12.5px] font-semibold leading-tight">
            {tr(title)}
          </h2>
          {hint ? (
            <p className="truncate text-[10.5px] text-muted-foreground">
              {tr(hint)}
            </p>
          ) : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

/** A statement line: label (+ small note) · amount, in or out */
export function Row({
  label,
  note,
  paise,
  kind,
  strong,
}: {
  label: string;
  note?: string;
  paise: number;
  kind?: "in" | "out";
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 px-4 py-[5px] leading-[18px]",
        strong && "bg-muted/40 py-2",
      )}
    >
      <span className="min-w-0">
        <span
          className={cn(
            "text-[12px]",
            strong ? "font-semibold" : "text-foreground/90",
          )}
        >
          {label}
        </span>
        {note ? (
          <span className="ml-1.5 text-[10.5px] text-muted-foreground">
            {note}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          strong ? "text-[13.5px] font-bold" : "text-[12px]",
          !strong && paise === 0 && "text-muted-foreground/60",
          !strong &&
            paise !== 0 &&
            kind === "in" &&
            "text-emerald-700 dark:text-emerald-400",
          !strong &&
            paise !== 0 &&
            kind === "out" &&
            "text-rose-700 dark:text-rose-400",
        )}
      >
        {kind && paise ? (kind === "in" ? "+ " : "− ") : ""}
        {inrFromPaise(paise)}
      </span>
    </div>
  );
}

/** Small uppercase heading inside a card */
export function Group({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 pb-0.5 pt-2.5 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

/** ₹ amount box: typed as rupees, kept as text until saved */
export function MoneyInput({
  id,
  value,
  onChange,
  label,
  autoFocus,
  className,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative block", className)}>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11.5px] text-muted-foreground">
        ₹
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        data-autofocus={autoFocus || undefined}
        value={value}
        placeholder="0"
        onChange={(e) =>
          onChange(e.target.value.replace(/[^\d.]/g, "").slice(0, 10))
        }
        className={cn(fieldClass, "h-8 pl-6 text-right tabular-nums")}
      />
    </span>
  );
}

/** Short / excess / matches */
export function DiffBadge({ paise }: { paise: number }) {
  const ok = Math.abs(paise) <= DIFF_TOLERANCE_PAISE;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums",
        ok
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          : paise < 0
            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
            : "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
      )}
    >
      {ok
        ? tr("Matches")
        : paise < 0
          ? tr("Short {{amt}}", { amt: inrFromPaise(-paise) })
          : tr("Excess {{amt}}", { amt: inrFromPaise(paise) })}
    </span>
  );
}
