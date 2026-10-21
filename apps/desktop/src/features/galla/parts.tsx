import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { DIFF_TOLERANCE_PAISE } from "@medicare/domain/cash/galla";
import { fieldClass } from "@/components/common/formStyles";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** A card of the galla screen: icon, title, hint, actions, body */
export function Panel({
  icon: Icon,
  title,
  hint,
  actions,
  children,
  className,
  tone = "primary",
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "primary" | "emerald" | "rose" | "amber";
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <header className="flex items-center gap-3 px-5 pb-3 pt-4">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            TONE[tone],
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold leading-tight">
            {tr(title)}
          </h2>
          {hint ? (
            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
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

const TONE = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
} as const;

/** ₹ amount box: typed as rupees, kept as text until saved */
export function MoneyInput({
  id,
  value,
  onChange,
  label,
  autoFocus,
  className,
  size = "md",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoFocus?: boolean;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <span className={cn("relative block", className)}>
      <span
        className={cn(
          "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground",
          size === "lg" ? "text-[15px]" : "text-[12px]",
        )}
      >
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
        className={cn(
          fieldClass,
          "pl-7 text-right tabular-nums",
          size === "lg" && "h-11 text-[16px] font-semibold",
        )}
      />
    </span>
  );
}

/** Short / excess / matches — the one thing the owner looks at */
export function DiffBadge({
  paise,
  size = "sm",
}: {
  paise: number;
  size?: "sm" | "lg";
}) {
  const ok = Math.abs(paise) <= DIFF_TOLERANCE_PAISE;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold tabular-nums",
        size === "lg" ? "px-3 py-1 text-[12.5px]" : "px-2.5 py-0.5 text-[11px]",
        ok
          ? "bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-300"
          : paise < 0
            ? "bg-rose-500/12 text-rose-700 ring-1 ring-rose-500/25 dark:text-rose-300"
            : "bg-sky-500/12 text-sky-700 ring-1 ring-sky-500/25 dark:text-sky-300",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          ok ? "bg-emerald-500" : paise < 0 ? "bg-rose-500" : "bg-sky-500",
        )}
      />
      {ok
        ? tr("Matches")
        : paise < 0
          ? tr("Short {{amt}}", { amt: inrFromPaise(-paise) })
          : tr("Excess {{amt}}", { amt: inrFromPaise(paise) })}
    </span>
  );
}

/** One flow line: icon · label (+ small note) · amount · share bar */
export function FlowRow({
  icon: Icon,
  label,
  note,
  paise,
  max,
  kind,
}: {
  icon: LucideIcon;
  label: string;
  note?: string;
  paise: number;
  max: number;
  kind: "in" | "out";
}) {
  const share = max > 0 ? Math.max(paise > 0 ? 3 : 0, (paise / max) * 100) : 0;
  return (
    <li className={cn("px-5 py-2.5", paise === 0 && "opacity-55")}>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            kind === "in"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium">
            {label}
          </span>
          {note ? (
            <span className="block truncate text-[10.5px] text-muted-foreground">
              {note}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "shrink-0 text-[13px] font-semibold tabular-nums",
            paise === 0
              ? "text-muted-foreground"
              : kind === "in"
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400",
          )}
        >
          {paise === 0
            ? "—"
            : `${kind === "in" ? "+" : "−"} ${inrFromPaise(paise)}`}
        </span>
      </div>
      <div className="ml-10 mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            kind === "in" ? "bg-emerald-500/70" : "bg-rose-500/70",
          )}
          style={{ width: `${share}%` }}
        />
      </div>
    </li>
  );
}
