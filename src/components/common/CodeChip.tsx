import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
  /** Rack / location */
  primary: "bg-primary/10 text-primary",
  /** Batch / invoice numbers */
  muted: "border border-border bg-muted/50 text-foreground",
} as const;

type Props = {
  children: ReactNode;
  tone?: keyof typeof TONE_CLASS;
  title?: string;
  className?: string;
};

/** Small monospace chip for codes like rack, batch and invoice numbers */
export function CodeChip({
  children,
  tone = "muted",
  title,
  className,
}: Props) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
