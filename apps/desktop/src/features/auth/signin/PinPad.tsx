import { useEffect, useEffectEvent } from "react";
import { Delete } from "lucide-react";
import { PIN_LENGTH } from "@medicare/domain/auth/users";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const KEYS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "clear",
  "0",
  "back",
];

/**
 * 4 dots + a number pad. Typing on the keyboard works too (digits,
 * Backspace); the PIN is sent by itself when the 4th digit is in.
 */
export function PinPad({
  value,
  onChange,
  onComplete,
  disabled,
  shake,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: (pin: string) => void;
  disabled?: boolean;
  /** Changes on every wrong PIN → the dots shake */
  shake: number;
}) {
  const press = (k: string) => {
    if (disabled) return;
    if (k === "back") return onChange(value.slice(0, -1));
    if (k === "clear") return onChange("");
    if (value.length >= PIN_LENGTH) return;
    const next = value + k;
    onChange(next);
    if (next.length === PIN_LENGTH) onComplete(next);
  };

  // Typing on the keyboard (always the latest value — no stale digits)
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === "Backspace") press("back");
    else if (e.key === "Delete") press("clear");
    else return;
    e.preventDefault();
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        key={shake}
        role="status"
        aria-label={tr("{{n}} of {{total}} digits", {
          n: value.length,
          total: PIN_LENGTH,
        })}
        className={cn("flex gap-4", shake > 0 && "animate-pin-shake")}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-4 w-4 rounded-full border-2 transition-all duration-150",
              i < value.length
                ? "scale-110 border-primary bg-primary"
                : "border-muted-foreground/40",
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => press(k)}
            aria-label={
              k === "back" ? tr("Delete") : k === "clear" ? tr("Clear") : k
            }
            className={cn(
              "h-14 w-[72px] rounded-2xl text-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              k === "back" || k === "clear"
                ? "text-[12px] text-muted-foreground hover:bg-muted"
                : "bg-muted/60 hover:bg-muted active:bg-primary/15 tabular-nums",
            )}
          >
            {k === "back" ? (
              <Delete className="mx-auto h-5 w-5" />
            ) : k === "clear" ? (
              tr("Clear")
            ) : (
              k
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
