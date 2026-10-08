import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Lock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { useCan } from "@/features/auth/store/useAuthStore";
import { useLicenseStore } from "./useLicenseStore";

/**
 * One line under the header when the licence needs attention:
 * amber = trial / ends soon, red = grace days or ON HOLD.
 * (Re-checked every 30 minutes, so it changes by itself at midnight.)
 */
export function LicenseBanner() {
  const state = useLicenseStore((s) => s.state);
  const load = useLicenseStore((s) => s.loadFromServer);
  const owner = useCan("admin");

  useEffect(() => {
    const t = setInterval(() => void load().catch(() => {}), 30 * 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (!state || state.status === "off" || !state.message) return null;
  const hold = !state.canWork;
  const red = hold || state.status === "grace";
  const Icon = hold ? Lock : TriangleAlert;

  return (
    <div
      role={red ? "alert" : "status"}
      className={cn(
        "shrink-0 flex items-center gap-2 px-4 py-1.5 text-[12px] border-b",
        red
          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900"
          : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate" title={state.message}>
        {hold ? <b>{tr("On hold")} — </b> : null}
        {tr(state.message)}
      </span>
      {owner ? (
        <Link
          to="/settings?section=license"
          className="shrink-0 font-semibold underline underline-offset-2"
        >
          {tr("Enter licence key")}
        </Link>
      ) : hold ? (
        <span className="shrink-0">{tr("Ask the owner")}</span>
      ) : null}
    </div>
  );
}
