import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  FolderOpen,
  Loader2,
  Monitor,
  MonitorCog,
  MonitorSmartphone,
  Search,
  Wifi,
  WifiOff,
} from "lucide-react";
import { ROLE_LABELS, type Role } from "@medicare/domain/auth/types";
import { Button } from "@/components/ui/button";
import { apiGet, apiRequest } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useLicenseStore } from "@/features/license/useLicenseStore";
import {
  desktopBridge,
  type DesktopBridge,
  type UpdateState,
} from "@/lib/desktop";

type SystemInfo = {
  lan: { enabled: boolean; canChange: boolean };
  port: number;
  addresses: string[];
};
type Counter = {
  ip: string;
  thisComputer: boolean;
  people: { name: string; role: Role }[];
  since: string;
};

const showError = (err: unknown) =>
  toast.error(err instanceof Error ? err.message : "Something went wrong");
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{tr(title)}</h2>
        {description ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {tr(description)}
          </p>
        ) : null}
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

/** On/off switch (role="switch") */
function Toggle({
  on,
  disabled,
  busy,
  onChange,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled || busy}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        on ? "bg-emerald-500" : "bg-muted-foreground/30",
      )}
    >
      <span
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : null}
      </span>
    </button>
  );
}

/**
 * Owner: share this (main) computer with the other billing counters, see
 * how they connect, and who is connected right now.
 */
export function NetworkSection() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () => apiGet<SystemInfo>("/api/system").then(setInfo, showError),
    [],
  );
  useEffect(() => void load(), [load]);

  const toggle = async () => {
    if (!info) return;
    setBusy(true);
    try {
      await apiRequest("POST", "/api/system/lan", {
        enabled: !info.lan.enabled,
      });
      // The server restarts on the new setting — wait until it answers again
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const next = await apiGet<SystemInfo>("/api/system").catch(() => null);
        if (next && next.lan.enabled !== info.lan.enabled) {
          setInfo(next);
          break;
        }
      }
      toast.success(
        tr(
          info.lan.enabled
            ? "Sharing switched off — only this computer can use MediCare"
            : "Sharing on — other counters can connect now",
        ),
      );
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };

  const bridge = desktopBridge();
  const on = info?.lan.enabled ?? false;

  return (
    <div className="space-y-3">
      <Card title="This computer & shop network">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              on
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {on ? (
              <Wifi className="h-5 w-5" />
            ) : (
              <WifiOff className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">
              {tr("Share with other counters")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {tr(
                on
                  ? "On — other billing computers in the shop use this computer's data over the Wi-Fi / cable. Keep MediCare open here while the shop is open."
                  : "Off — only this computer uses MediCare. Turn on when you add a second billing counter.",
              )}
            </p>
          </div>
          <Toggle
            on={on}
            busy={busy}
            disabled={!info?.lan.canChange}
            onChange={() => void toggle()}
            label={tr("Share with other counters")}
          />
        </div>
        {info && !info.lan.canChange ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
            {tr(
              "To share, start the server with HOST=0.0.0.0 (the installed app has a switch here).",
            )}
          </p>
        ) : null}

        {on && info ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold">
                <Search className="h-4 w-4 text-primary" />
                {tr("Add a counter — the easy way")}
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-[11px] text-muted-foreground">
                <li>{tr("Install MediCare Pharmacy on that computer.")}</li>
                <li>{tr("On its first start choose “Extra counter”.")}</li>
                <li>
                  {tr(
                    "Click “Find main computer” — it finds this one by itself.",
                  )}
                </li>
              </ol>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="mb-2 text-[12px] font-semibold">
                {tr("Or type this address there")}
              </p>
              {info.addresses.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {tr(
                    "No network found — connect this computer to the shop Wi-Fi / cable.",
                  )}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {info.addresses.map((a) => (
                    <div
                      key={a}
                      className="flex items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-1.5"
                    >
                      <code className="text-[14px] font-semibold tracking-wide">
                        {a.replace(/^http:\/\//, "")}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          navigator.clipboard
                            ?.writeText(a)
                            .then(() => toast.success(tr("Copied")))
                        }
                        className="h-7 rounded-md text-[11px] gap-1"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {tr("Copy")}
                      </Button>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground">
                    {tr("Chrome / Edge on that computer works too.")}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Card>

      <ConnectedNow sharing={on} />

      {bridge ? (
        <Card title="This computer">
          <AppVersion bridge={bridge} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void bridge.openDataFolder()}
              className="h-8 rounded-lg text-[11px] gap-1.5"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {tr("Open data folder")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void bridge.openSetup()}
              className="h-8 rounded-lg text-[11px] gap-1.5"
            >
              <MonitorCog className="h-3.5 w-3.5" />
              {tr("Change setup of this computer")}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

/** Which computers have MediCare open right now (refreshes by itself) */
function ConnectedNow({ sharing }: { sharing: boolean }) {
  const [list, setList] = useState<Counter[] | null>(null);
  const allowed = useLicenseStore((s) => s.state?.counters ?? null);
  useEffect(() => {
    const fetchList = () =>
      apiGet<{ counters: Counter[] }>("/api/system/counters").then(
        (r) => setList(r.counters),
        () => {},
      );
    void fetchList();
    const id = window.setInterval(fetchList, 10_000);
    return () => window.clearInterval(id);
  }, []);

  const others = list?.filter((c) => !c.thisComputer).length ?? 0;

  return (
    <Card
      title="Connected now"
      description={
        allowed
          ? tr("{{n}} of {{max}} computers your licence allows", {
              n: (list?.length ?? 0) || 1,
              max: allowed,
            })
          : "Computers with MediCare open right now — updates every 10 seconds."
      }
    >
      {list === null ? (
        <p className="text-[12px] text-muted-foreground">{tr("Loading…")}</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl border border-border">
          {list.map((c) => (
            <li
              key={c.ip || "this"}
              className="flex flex-wrap items-center gap-3 px-3 py-2.5"
            >
              <span className="relative">
                {c.thisComputer ? (
                  <Monitor className="h-5 w-5 text-primary" />
                ) : (
                  <MonitorSmartphone className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" />
              </span>
              <div className="min-w-[140px]">
                <p className="text-[12px] font-semibold">
                  {c.thisComputer ? tr("This computer (main)") : c.ip}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {tr("since {{time}}", { time: time(c.since) })}
                </p>
              </div>
              <div className="flex flex-1 flex-wrap justify-end gap-1.5">
                {c.people.map((p) => (
                  <span
                    key={p.name}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]"
                  >
                    <b className="font-medium">{p.name}</b>
                    <span className="text-muted-foreground">
                      · {tr(ROLE_LABELS[p.role] ?? p.role)}
                    </span>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {list && others === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {tr(
            sharing
              ? "No other counter connected yet."
              : "Only this computer — sharing is off.",
          )}
        </p>
      ) : null}
    </Card>
  );
}

const UPDATE_TEXT: Record<UpdateState["status"], string> = {
  off: "Automatic updates are off in this copy",
  idle: "Up to date",
  checking: "Checking for updates…",
  downloading: "Downloading the new version…",
  ready: "New version ready — it installs when MediCare restarts",
  error: "Couldn't check (no internet?) — will try again later",
};

/** Installed app: version + free automatic updates (GitHub Releases) */
function AppVersion({ bridge }: { bridge: DesktopBridge }) {
  const [u, setU] = useState<UpdateState | null>(null);
  useEffect(() => void bridge.updates().then(setU, () => {}), [bridge]);
  if (!u) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px]">
      <span>
        MediCare <b>{u.version}</b> ·{" "}
        <span className="text-muted-foreground">
          {tr(UPDATE_TEXT[u.status])}
          {u.available ? ` (${u.available})` : ""}
        </span>
      </span>
      {u.status !== "off" ? (
        <Button
          type="button"
          variant="ghost"
          className="h-7 rounded-md text-[11px]"
          onClick={() => {
            setU({ ...u, status: "checking" });
            void bridge.checkUpdates().then(setU, () => {});
          }}
        >
          {tr("Check now")}
        </Button>
      ) : null}
    </div>
  );
}
