import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTr } from "@/hooks/useTr";

export type BadgeTone =
  "success" | "warning" | "danger" | "caution" | "neutral" | "info";

const TONE_CLASS: Record<BadgeTone, string> = {
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
  warning:
    "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400",
  caution:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
  danger: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400",
  neutral: "bg-muted text-muted-foreground",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400",
};

const SIZE_CLASS = {
  /** Tables and dialogs */
  sm: "px-2 py-0.5 text-[10px]",
  /** Dense widgets (dashboard, billing side panels) */
  xs: "px-1.5 py-0.5 text-[9px]",
} as const;

const SHAPE_CLASS = {
  pill: "rounded-full",
  rounded: "rounded-md",
} as const;

type Props = {
  tone: BadgeTone;
  children: ReactNode;
  size?: keyof typeof SIZE_CLASS;
  shape?: keyof typeof SHAPE_CLASS;
  /** Tooltip */
  title?: string;
  className?: string;
};

/** Coloured status label used across Inventory, Medicines, Purchases, Billing and Dashboard */
export function StatusBadge({
  tone,
  children,
  size = "sm",
  shape = "pill",
  title,
  className,
}: Props) {
  const tr = useTr();
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        SIZE_CLASS[size],
        SHAPE_CLASS[shape],
        className,
      )}
    >
      {tr(children)}
    </span>
  );
}
