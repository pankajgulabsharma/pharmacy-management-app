import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  KeyRound,
  LifeBuoy,
  Lock,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { useCan } from "@/features/auth/store/useAuthStore";
import { SupportDialog } from "@/features/support/SupportDialog";
import { useLicenseStore, type LicenseState } from "./useLicenseStore";

/** Built-in trial length (server: license/state.ts TRIAL_DAYS) */
const TRIAL_DAYS = 30;
/** From here on the trial bar turns amber */
const TRIAL_URGENT_DAYS = 5;

type Look = {
  tone: "trial" | "warn" | "danger";
  icon: LucideIcon;
  pill: string;
  title: string;
  text: string;
};

const DAY = 86_400_000;

/** How long this trial is (a trial key has its own length) */
function trialLength(s: LicenseState) {
  const l = s.license;
  if (l?.trial)
    return (
      Math.round((Date.parse(l.expiresAt) - Date.parse(l.issuedAt)) / DAY) + 1
    );
  return TRIAL_DAYS;
}

function lookOf(s: LicenseState): Look {
  const left = s.daysLeft ?? 0;
  const days =
    left === 1 ? tr("1 day left") : tr("{{n}} days left", { n: left });
  if (!s.canWork)
    return {
      tone: "danger",
      icon: Lock,
      pill: tr("On hold"),
      title: tr("Billing is paused"),
      text: tr(s.message),
    };
  if (s.status === "grace")
    return {
      tone: "danger",
      icon: TriangleAlert,
      pill: tr("Licence ended"),
      title: days,
      text: tr("Renew now — billing stops when these days are over."),
    };
  if (s.status === "trial")
    return {
      tone: left <= TRIAL_URGENT_DAYS ? "warn" : "trial",
      icon: Sparkles,
      pill: tr("Free trial"),
      title: days,
      text: tr(
        "Single computer trial — one billing counter. Activate your licence any time.",
      ),
    };
  return {
    tone: "warn",
    icon: TriangleAlert,
    pill: tr("Renewal due"),
    title: days,
    text: tr("Renew the AMC in time — nothing changes until the last day."),
  };
}

const TONE = {
  trial:
    "bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 text-white border-indigo-700",
  warn: "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 border-amber-200 dark:from-amber-950/60 dark:to-orange-950/40 dark:text-amber-200 dark:border-amber-900",
  danger:
    "bg-gradient-to-r from-red-50 to-rose-50 text-red-800 border-red-200 dark:from-red-950/60 dark:to-rose-950/40 dark:text-red-200 dark:border-red-900",
} as const;

/**
 * The licence bar under the header: a friendly trial countdown (with how
 * much of the trial is used), turning amber in the last days and red for
 * grace days / on hold. Re-checked every 30 minutes.
 */
export function LicenseBanner() {
  const state = useLicenseStore((s) => s.state);
  const load = useLicenseStore((s) => s.loadFromServer);
  const owner = useCan("admin");
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const t = setInterval(() => void load().catch(() => {}), 30 * 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (!state || state.status === "off" || !state.message) return null;
  const look = lookOf(state);
  // Always shown until a licence is entered — it can't be closed

  const Icon = look.icon;
  const onDark = look.tone === "trial";
  const total = state.status === "trial" ? trialLength(state) : 0;
  const usedPct = total
    ? Math.min(
        100,
        Math.max(4, ((total - (state.daysLeft ?? 0)) / total) * 100),
      )
    : 0;

  return (
    <div
      role={look.tone === "danger" ? "alert" : "status"}
      className={cn(
        "relative shrink-0 flex items-center gap-3 overflow-hidden border-b px-4 py-2",
        TONE[look.tone],
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          onDark ? "bg-white/15" : "bg-current/10",
        )}
      >
        <Icon className={cn("h-4 w-4", onDark ? "text-white" : "")} />
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          onDark ? "bg-white/20 text-white" : "bg-current/10",
        )}
      >
        {look.pill}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px]" title={state.message}>
          <b className="font-semibold">{look.title}</b>
          <span className={cn("ml-2", onDark ? "text-white/80" : "opacity-80")}>
            {look.text}
          </span>
        </p>
        {total ? (
          <div
            className={cn(
              "mt-1 h-1 w-full max-w-[260px] overflow-hidden rounded-full",
              onDark ? "bg-white/20" : "bg-current/15",
            )}
            aria-hidden="true"
          >
            <div
              className={cn(
                "h-full rounded-full",
                onDark ? "bg-white" : "bg-current",
              )}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setHelp(true)}
          className={cn(
            "hidden h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-medium sm:inline-flex",
            onDark ? "text-white/90 hover:bg-white/15" : "hover:bg-current/10",
          )}
        >
          <LifeBuoy className="h-3.5 w-3.5" />
          {tr("Contact support")}
        </button>
        {owner ? (
          <Link
            to="/settings?section=license"
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold shadow-sm transition",
              onDark
                ? "bg-white text-indigo-700 hover:bg-indigo-50"
                : look.tone === "danger"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-amber-600 text-white hover:bg-amber-700",
            )}
          >
            <KeyRound className="h-3.5 w-3.5" />
            {tr(
              state.status === "trial"
                ? "Activate licence"
                : "Enter licence key",
            )}
          </Link>
        ) : !state.canWork ? (
          <span className="text-[11px] font-medium">{tr("Ask the owner")}</span>
        ) : null}
      </div>
      {help ? <SupportDialog onClose={() => setHelp(false)} /> : null}
    </div>
  );
}
