import { formatCombo, preferredCombo } from "@/lib/hotkeys";
import { cn } from "@/lib/utils";

type Props = {
  /** A combo like "F9", or alternatives — the one that suits this computer is shown */
  keys: string | readonly string[];
  className?: string;
  /** "light" for use on solid-colour buttons */
  tone?: "default" | "light";
};

/** Shows a keyboard shortcut, e.g. [Ctrl] [Enter] */
export function Kbd({ keys, className, tone = "default" }: Props) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-hidden="true"
    >
      {formatCombo(preferredCombo(keys)).map((k, i) => (
        <kbd
          key={i}
          className={cn(
            "min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded border font-mono text-[9px] font-medium leading-none",
            tone === "light"
              ? "border-white/40 bg-white/15 text-current"
              : "border-border bg-muted text-muted-foreground",
          )}
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
