import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, FolderOpen, MonitorCog, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { apiGet, apiRequest } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { SettingsCard } from "./SettingsCard";

type SystemInfo = {
  lan: { enabled: boolean; canChange: boolean };
  port: number;
  addresses: string[];
};

/** Only inside the installed app (see installer/src/preload.cts) */
type DesktopBridge = {
  openSetup: () => Promise<void>;
  openDataFolder: () => Promise<void>;
};
const desktop = () =>
  (window as unknown as { medicareDesktop?: DesktopBridge }).medicareDesktop;

const showError = (err: unknown) =>
  toast.error(err instanceof Error ? err.message : "Something went wrong");

/**
 * Owner: share this (main) computer with other counters on the shop
 * network, and see the address they connect to.
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

  const bridge = desktop();
  const on = info?.lan.enabled ?? false;

  return (
    <SettingsCard
      title="This computer & shop network"
      description="This is the main computer: it keeps the data. Other billing counters in the shop connect to it over the shop's Wi-Fi / network."
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={on ? "success" : "neutral"} shape="rounded">
          {on ? "Shared on the shop network" : "This computer only"}
        </StatusBadge>
        {info?.lan.canChange ? (
          <Button
            type="button"
            variant={on ? "outline" : "default"}
            disabled={busy}
            onClick={toggle}
            className="h-8 rounded-lg text-[11px] gap-1.5"
          >
            {on ? (
              <WifiOff className="h-3.5 w-3.5" />
            ) : (
              <Wifi className="h-3.5 w-3.5" />
            )}
            {tr(on ? "Stop sharing" : "Share with other counters")}
          </Button>
        ) : info ? (
          <p className="text-[11px] text-muted-foreground">
            {tr(
              "To share, start the server with HOST=0.0.0.0 (the installed app has a switch here).",
            )}
          </p>
        ) : null}
      </div>

      {on ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <p className="text-[12px] font-medium">
            {tr("Address for the other counters")}
          </p>
          {info!.addresses.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {tr(
                "No network found — connect this computer to the shop Wi-Fi / cable.",
              )}
            </p>
          ) : (
            info!.addresses.map((a) => (
              <div key={a} className="flex items-center gap-2">
                <code className="text-[13px] font-semibold">{a}</code>
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
            ))
          )}
          <ol className="list-decimal pl-4 text-[11px] text-muted-foreground space-y-0.5">
            <li>{tr("On the other computer, install MediCare Pharmacy.")}</li>
            <li>
              {tr(
                "On its first start choose “Extra counter” and type the address above.",
              )}
            </li>
            <li>
              {tr(
                "Or simply open the address in Chrome / Edge on that computer.",
              )}
            </li>
            <li>
              {tr(
                "Keep MediCare open on this computer while the shop is open.",
              )}
            </li>
          </ol>
        </div>
      ) : null}

      {bridge ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
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
      ) : null}
    </SettingsCard>
  );
}
