import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { fieldClass } from "@/components/common/formStyles";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** A titled card of the galla screen */
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
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold leading-tight">
            {tr(title)}
          </h2>
          {hint ? (
            <p className="truncate text-[10.5px] text-muted-foreground">
              {tr(hint)}
            </p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** One line of a money statement: label · amount */
export function Line({
  label,
  paise,
  sign,
  strong,
  muted,
}: {
  label: string;
  paise: number;
  sign?: "+" | "−";
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 py-1 text-[12px]",
        strong && "text-[14px] font-bold",
        muted && "text-muted-foreground",
      )}
    >
      <span className="min-w-0 truncate">
        {sign ? (
          <span
            className={cn(
              "mr-1.5 inline-block w-3 text-center font-semibold",
              sign === "+"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {sign}
          </span>
        ) : null}
        {label}
      </span>
      <span className="shrink-0 tabular-nums">{inrFromPaise(paise)}</span>
    </div>
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
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
        ₹
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        data-autofocus={autoFocus || undefined}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/[^\d.]/g, "").slice(0, 10))
        }
        className={cn(fieldClass, "pl-6 text-right tabular-nums")}
      />
    </span>
  );
}

/** Short / excess / matches — the one number the owner looks at */
export function DiffBadge({ paise }: { paise: number }) {
  const ok = Math.abs(paise) <= 100;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
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
