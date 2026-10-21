import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/brand/AppLogo";
import { tr } from "@/lib/i18n";

/**
 * The MediCare loader: logo breathing inside two counter-turning rings and
 * a sliding bar. Same look as the first-start screen (styles live in
 * index.html, so it shows even before any script has loaded).
 *   size="page"   — loading shop data (title + message + bar)
 *   size="screen" — a screen's code arriving (rings only, smaller)
 */
export function AppLoader({
  message = "Loading shop data…",
  size = "page",
  className,
}: {
  message?: string;
  size?: "page" | "screen";
  className?: string;
}) {
  return (
    <div className={cn("h-full w-full grid place-items-center", className)}>
      <div
        className={cn("mc-loader", size === "screen" && "scale-75 opacity-90")}
        role="status"
        aria-live="polite"
        aria-label={tr(message)}
      >
        <div className="mc-orb">
          <AppLogo className="mc-logo" />
        </div>
        {size === "page" ? (
          <>
            <p className="mc-title">MediCare Pharmacy</p>
            <p className="mc-sub">{tr(message)}</p>
            <div className="mc-bar" />
          </>
        ) : null}
      </div>
    </div>
  );
}
