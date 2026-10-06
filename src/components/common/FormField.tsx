import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTr } from "@/hooks/useTr";

type Props = {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
};

/** Label + control + error/hint, with consistent spacing across all dialogs */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: Props) {
  const tr = useTr();
  return (
    <div className={cn("space-y-1 min-w-0", className)}>
      <label
        htmlFor={htmlFor}
        className="block truncate text-[11px] font-medium text-foreground"
      >
        {tr(label)}
      </label>
      <div className="p-0.5">{children}</div>
      {error ? (
        <p className="text-[10px] text-red-500 px-0.5" role="alert">
          {tr(error)}
        </p>
      ) : hint ? (
        <p className="text-[10px] text-muted-foreground px-0.5 truncate">
          {tr(hint)}
        </p>
      ) : null}
    </div>
  );
}
