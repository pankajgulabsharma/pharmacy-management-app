import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

/**
 * "Upgrade" — a primary button with a soft light sweeping across it (the
 * shimmer popular sites use), so it reads as an offer, not a warning.
 * Respects "reduce motion".
 */
export function UpgradeButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative inline-flex h-9 items-center gap-1.5 overflow-hidden rounded-lg bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-4 text-[12px] font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg hover:shadow-indigo-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent animate-shimmer motion-reduce:hidden"
      />
      <Sparkles className="relative h-3.5 w-3.5" />
      <span className="relative">{tr("Upgrade")}</span>
    </button>
  );
}
