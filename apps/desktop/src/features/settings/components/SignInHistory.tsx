import { useCallback, useEffect, useMemo, useState } from "react";
import { History, KeyRound, LogIn, LogOut, RefreshCw } from "lucide-react";
import {
  formatMinutes,
  minutesOn,
  SIGN_OUT_LABEL,
  type SignInRecord,
} from "@medicare/domain/auth/signIns";
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

const at = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

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

  const load = useCallback(() => {
    if (!on) return;
    apiGet<{ items: SignInRecord[] }>(
      `/api/signins?from=${from}&to=${to}`,
    ).then(
      (r) => {
        setError(null);
        setItems(r.items);
      },
      (e: Error) => setError(e.message),
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
  const shown = (items ?? []).filter(
    (r) =>
      (!person || r.userName === person) && (!counter || r.counter === counter),
  );

  if (!on)
    return (
      <LockedFeature
        title="Sign-in history"
        description="See who signed in, on which counter, and when they left — part of the Multi-counter plan."
      />
    );

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <History className="h-4 w-4" />
        </span>
        <div className="mr-auto min-w-0">
          <h2 className="text-sm font-semibold">{tr("Sign-in history")}</h2>
          <p className="text-[11px] text-muted-foreground">
            {tr(
              "Who signed in, on which counter, and when they left. Kept for a year.",
            )}
          </p>
        </div>
        <DateInput
          aria-label={tr("From")}
          value={from}
          max={to}
          onChange={(e) => e.target.value && setFrom(e.target.value)}
          className={cn(fieldClass, "h-8 w-[136px]")}
        />
        <span className="text-[11px] text-muted-foreground">–</span>
        <DateInput
          aria-label={tr("To")}
          value={to}
          min={from}
          max={today}
          onChange={(e) => e.target.value && setTo(e.target.value)}
          className={cn(fieldClass, "h-8 w-[136px]")}
        />
        <select
          aria-label={tr("Person")}
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className={cn(fieldClass, "h-8 w-36")}
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
            className={cn(fieldClass, "h-8 w-32")}
          >
            <option value="">{tr("All counters")}</option>
            {counters.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={load}
          aria-label={tr("Refresh")}
          className="h-8 rounded-lg"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
      {error ? (
        <p className="px-4 py-6 text-center text-[12px] text-rose-600">
          {error}
        </p>
      ) : !items ? null : shown.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">
          {tr("No sign-ins in these days.")}
        </p>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 z-10 bg-muted/80 text-[10.5px] uppercase tracking-wide text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">
                  {tr("Person")}
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  {tr("Counter")}
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  {tr("Signed in")}
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  {tr("Signed out")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {tr("Time")}
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-4 py-2">
                    <p className="font-medium">{r.userName}</p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {tr(ROLE_LABELS[r.role as Role] ?? r.role)}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <p>{r.counter || "—"}</p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {r.computer ? r.computer : tr("Main computer")}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="flex items-center gap-1.5 tabular-nums">
                      <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                      {at(r.signedInAt)}
                    </p>
                    <p className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                      <KeyRound className="h-3 w-3" />
                      {tr(
                        r.method === "pin"
                          ? "PIN"
                          : r.method === "setup"
                            ? "First setup"
                            : "Password",
                      )}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {r.signedOutAt ? (
                      <>
                        <p className="flex items-center gap-1.5 tabular-nums">
                          <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                          {at(r.signedOutAt)}
                        </p>
                        <p className="text-[10.5px] text-muted-foreground">
                          {r.reason ? tr(SIGN_OUT_LABEL[r.reason]) : ""}
                        </p>
                      </>
                    ) : r.appOpen ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                        {tr("Signed in now")}
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground"
                        title={tr(
                          "The app was closed without signing out — the session ends by itself",
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        {tr("App closed, not signed out")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatMinutes(minutesOn(r))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
