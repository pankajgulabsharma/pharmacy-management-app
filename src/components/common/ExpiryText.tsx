import { cn } from "@/lib/utils";

export type ExpiryState = "ok" | "expiring" | "expired";

type Props = {
  /** Expiry as printed, e.g. "08/27". Empty/null shows a dash. */
  value: string | null | undefined;
  state: ExpiryState;
  /** Show "Expired" / "Expiring soon" under the date */
  showLabel?: boolean;
};

/**
 * Expiry date coloured by state. The caller decides the state, so this
 * stays independent of how each feature parses dates.
 */
export function ExpiryText({ value, state, showLabel = true }: Props) {
  if (!value) return <span className="text-muted-foreground">—</span>;

  return (
    <>
      <p
        className={cn(
          "font-medium tabular-nums whitespace-nowrap",
          state === "expired"
            ? "text-red-600 dark:text-red-400"
            : state === "expiring"
              ? "text-amber-600 dark:text-amber-400"
              : "text-foreground",
        )}
      >
        {value}
      </p>
      {showLabel && state !== "ok" ? (
        <p
          className={cn(
            "mt-0.5 text-[10px]",
            state === "expired"
              ? "text-red-500/80"
              : "text-amber-600/80 dark:text-amber-400/80",
          )}
        >
          {state === "expired" ? "Expired" : "Expiring soon"}
        </p>
      ) : null}
    </>
  );
}
