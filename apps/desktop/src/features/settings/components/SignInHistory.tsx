import { useCallback, useEffect, useMemo, useState } from "react";
import {
  History,
  KeyRound,
  Monitor,
  RefreshCw,
  UserRound,
  Users,
  Wifi,
} from "lucide-react";
import {
  formatMinutes,
  minutesOn,
  SIGN_OUT_LABEL,
  type SignInRecord,
} from "@medicare/domain/auth/signIns";
import { initials } from "@medicare/domain/auth/users";
import { ROLE_LABELS, type Role } from "@medicare/domain/auth/types";
import { businessDate } from "@medicare/domain/cash/galla";
import { DateInput } from "@/components/common/DateInput";
import { fieldClass } from "@/components/common/formStyles";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/features/license/useLicenseStore";
import { LockedFeature } from "@/features/support/LockedFeature";
import { apiGet } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
const dayKey = (iso: string) => businessDate(new Date(iso));
const dayTitle = (key: string) => {
  const today = businessDate();
  const yesterday = businessDate(new Date(Date.now() - 86_400_000));
  const label = new Date(`${key}T00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return key === today
    ? `${tr("Today")} · ${label}`
    : key === yesterday
      ? `${tr("Yesterday")} · ${label}`
      : label;
};

/** The shop day on the little time bar: 7 am – 11 pm */
const BAR_FROM = 7;
const BAR_TO = 23;
const pos = (d: Date) =>
  Math.min(
    100,
    Math.max(
      0,
      ((d.getHours() + d.getMinutes() / 60 - BAR_FROM) / (BAR_TO - BAR_FROM)) *
        100,
    ),
  );

const ROLE_TINT: Record<string, string> = {
  owner: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  pharmacist: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  cashier: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

/**
 * Owner (Multi-counter plan): who signed in, on which counter and
 * computer, how, and for how long — a week at a time by default.
 */
export function SignInHistory() {
  const on = usePlan().has("signInLog");
  const today = businessDate();
  const [from, setFrom] = useState(() =>
    businessDate(new Date(Date.now() - 6 * 86_400_000)),
  );
  const [to, setTo] = useState(today);
  const [person, setPerson] = useState("");
  const [counter, setCounter] = useState("");
  const [items, setItems] = useState<SignInRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!on) return;
    apiGet<{ items: SignInRecord[] }>(
      `/api/signins?from=${from}&to=${to}`,
    ).then(
      (r) => {
        setError(null);
        setItems(r.items);
        setBusy(false);
      },
      (e: Error) => {
        setError(e.message);
        setBusy(false);
      },
    );
  }, [on, from, to]);
  useEffect(load, [load]);

  const people = useMemo(
    () => [...new Set((items ?? []).map((r) => r.userName))].sort(),
    [items],
  );
  const counters = useMemo(
    () =>
      [...new Set((items ?? []).map((r) => r.counter).filter(Boolean))].sort(),
    [items],
  );
  const shown = useMemo(
    () =>
      (items ?? []).filter(
        (r) =>
          (!person || r.userName === person) &&
          (!counter || r.counter === counter),
      ),
    [items, person, counter],
  );
  const days = useMemo(() => {
    const m = new Map<string, SignInRecord[]>();
    for (const r of shown) {
      const k = dayKey(r.signedInAt);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [shown]);

  if (!on)
    return (
      <LockedFeature
        title="Sign-in history"
        description="See who signed in, on which counter, and when they left — part of the Multi-counter plan."
      />
    );

  const liveNow = shown.filter((r) => r.appOpen).length;
  const totalMin = shown.reduce((a, r) => a + minutesOn(r), 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Title + filters */}
      <div className="flex flex-wrap items-center gap-3 px-5 pb-4 pt-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <History className="h-5 w-5" />
        </span>
        <div className="mr-auto min-w-0">
          <h2 className="text-[15px] font-semibold">{tr("Sign-in history")}</h2>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {tr(
              "Who signed in, on which counter, and when they left. Kept for a year.",
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setBusy(true);
            load();
          }}
          aria-label={tr("Refresh")}
          title={tr("Refresh")}
          className="h-9 w-9 rounded-xl p-0"
        >
          <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-y border-border bg-muted/25 px-5 py-3">
        <div className="flex items-center gap-1.5">
          <DateInput
            aria-label={tr("From")}
            value={from}
            max={to}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            className={cn(fieldClass, "h-9 w-[140px]")}
          />
          <span className="text-[12px] text-muted-foreground">→</span>
          <DateInput
            aria-label={tr("To")}
            value={to}
            min={from}
            max={today}
            onChange={(e) => e.target.value && setTo(e.target.value)}
            className={cn(fieldClass, "h-9 w-[140px]")}
          />
        </div>
        <select
          aria-label={tr("Person")}
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className={cn(fieldClass, "h-9 w-40")}
        >
          <option value="">{tr("Everyone")}</option>
          {people.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        {counters.length > 1 ? (
          <select
            aria-label={tr("Counter")}
            value={counter}
            onChange={(e) => setCounter(e.target.value)}
            className={cn(fieldClass, "h-9 w-36")}
          >
            <option value="">{tr("All counters")}</option>
            {counters.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        ) : null}
      </div>

      {/* At a glance */}
      <div className="grid grid-cols-2 gap-3 px-5 pt-4 md:grid-cols-4">
        <Kpi
          icon={Wifi}
          label={tr("Signed in now")}
          value={String(liveNow)}
          live={liveNow > 0}
        />
        <Kpi
          icon={KeyRound}
          label={tr("Sign-ins")}
          value={String(shown.length)}
        />
        <Kpi
          icon={Users}
          label={tr("People")}
          value={String(new Set(shown.map((r) => r.userName)).size)}
        />
        <Kpi
          icon={UserRound}
          label={tr("Time worked")}
          value={formatMinutes(totalMin)}
        />
      </div>

      {error ? (
        <p className="px-5 py-8 text-center text-[12.5px] text-rose-600">
          {error}
        </p>
      ) : !items ? (
        <div className="space-y-2 p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : days.length === 0 ? (
        <p className="px-5 py-10 text-center text-[12.5px] text-muted-foreground">
          {tr("No sign-ins in these days.")}
        </p>
      ) : (
        <div className="max-h-[520px] overflow-y-auto px-5 pb-5 pt-4">
          {days.map(([key, rows]) => (
            <div key={key} className="mb-4 last:mb-0">
              <div className="sticky top-0 z-10 -mx-1 mb-2 flex items-center gap-3 bg-card/95 px-1 py-1.5 backdrop-blur">
                <p className="text-[12px] font-semibold">{dayTitle(key)}</p>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground">
                  {tr(rows.length === 1 ? "1 sign-in" : "{{n}} sign-ins", {
                    n: rows.length,
                  })}
                </span>
              </div>
              <ul className="space-y-1.5">
                {rows.map((r) => (
                  <Row key={r.id} r={r} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  live,
}: {
  icon: typeof Wifi;
  label: string;
  value: string;
  live?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
        {live ? (
          <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        ) : null}
      </p>
      <p className="mt-1 text-[18px] font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Row({ r }: { r: SignInRecord }) {
  const start = new Date(r.signedInAt);
  const end = r.signedOutAt ? new Date(r.signedOutAt) : new Date();
  const left = pos(start);
  const width = Math.max(1.5, pos(end) - left);
  const open = !r.signedOutAt;
  return (
    <li className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto] items-center gap-4 rounded-xl border border-transparent px-3 py-2.5 transition hover:border-border hover:bg-muted/30">
      {/* Who */}
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
            ROLE_TINT[r.role] ?? "bg-muted text-foreground",
          )}
        >
          {initials(r.userName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{r.userName}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {tr(ROLE_LABELS[r.role as Role] ?? r.role)} ·{" "}
            {tr(
              r.method === "pin"
                ? "PIN"
                : r.method === "setup"
                  ? "First setup"
                  : "Password",
            )}
          </p>
        </div>
      </div>
      {/* Where */}
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-[12.5px] font-medium">
          <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {r.counter || tr("Counter not set")}
        </p>
        <p className="truncate pl-5 text-[11px] text-muted-foreground">
          {r.computer ? r.computer : tr("Main computer")}
        </p>
      </div>
      {/* When: times + a bar across the shop day */}
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[12.5px] tabular-nums">
          <span className="font-medium">{clock(r.signedInAt)}</span>
          <span className="text-muted-foreground">→</span>
          {r.signedOutAt ? (
            <span className="font-medium">{clock(r.signedOutAt)}</span>
          ) : (
            <span className="text-muted-foreground">{tr("now")}</span>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">
            {formatMinutes(minutesOn(r))}
          </span>
        </p>
        <div
          className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
          title={`${clock(r.signedInAt)} – ${r.signedOutAt ? clock(r.signedOutAt) : tr("now")}`}
        >
          <div
            className={cn(
              "absolute inset-y-0 rounded-full",
              r.appOpen
                ? "bg-emerald-500"
                : open
                  ? "bg-slate-400"
                  : "bg-gradient-to-r from-indigo-500 to-violet-500",
            )}
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        </div>
      </div>
      {/* How it ended */}
      <div className="w-[150px] text-right">
        {r.appOpen ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            {tr("Signed in now")}
          </span>
        ) : open ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            title={tr(
              "The app was closed without signing out — the session ends by itself",
            )}
          >
            {tr("App closed, not signed out")}
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
              r.reason === "signed_out"
                ? "bg-slate-500/10 text-slate-600 dark:text-slate-300"
                : r.reason === "removed"
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
            )}
          >
            {r.reason ? tr(SIGN_OUT_LABEL[r.reason]) : ""}
          </span>
        )}
      </div>
    </li>
  );
}
