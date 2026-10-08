import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { fieldClass } from "@/components/common/formStyles";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import {
  useLicenseStore,
  type LicenseState,
} from "@/features/license/useLicenseStore";
import { SettingsCard } from "./SettingsCard";

const STATUS: Record<
  LicenseState["status"],
  { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info" }
> = {
  off: { label: "Not checked (development)", tone: "neutral" },
  trial: { label: "Free trial", tone: "info" },
  active: { label: "Active", tone: "success" },
  grace: { label: "Ended — grace days", tone: "warning" },
  expired: { label: "On hold", tone: "danger" },
  clock: { label: "On hold — wrong date", tone: "danger" },
};

/**
 * Owner: licence status, this computer's machine code (send it to the
 * provider) and the box to paste the new key into. Works while on hold.
 */
export function LicenseSection() {
  const state = useLicenseStore((s) => s.state);
  const load = useLicenseStore((s) => s.loadFromServer);
  const saveKey = useLicenseStore((s) => s.saveKey);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => void load().catch(() => {}), [load]);

  // (No <form> here: this card is already a form — forms can't nest)
  const submit = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      const s = await saveKey(key.trim());
      setKey("");
      toast.success(
        tr("Licence saved — works until {{date}}", {
          date: s.license?.expiresAt ?? "",
        }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (!state)
    return (
      <SettingsCard title="Licence" description="">
        <p className="text-[12px] text-muted-foreground">{tr("Loading…")}</p>
      </SettingsCard>
    );

  const st = STATUS[state.status];
  const l = state.license;
  return (
    <SettingsCard
      title="Licence"
      description="This shop's licence. When it ends, billing goes on hold until a new key is entered — your data always stays safe and viewable."
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={st.tone} shape="rounded">
          {st.label}
        </StatusBadge>
        {state.status === "off" ? (
          <span className="text-[12px] text-muted-foreground">
            {tr(
              "Development copy — licence is checked only in the installed app. To try it here, start the server with: npm run dev:server:license",
            )}
          </span>
        ) : null}
        {state.message ? (
          <span className="text-[12px] text-muted-foreground">
            {tr(state.message)}
          </span>
        ) : null}
      </div>

      <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-[12px]">
        <dt className="text-muted-foreground">{tr("Machine code")}</dt>
        <dd className="flex items-center gap-2">
          <code className="text-[13px] font-semibold tracking-wide">
            {state.machine}
          </code>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              navigator.clipboard
                ?.writeText(state.machine)
                .then(() => toast.success(tr("Copied")))
            }
            className="h-7 rounded-md text-[11px] gap-1"
          >
            <Copy className="h-3.5 w-3.5" />
            {tr("Copy")}
          </Button>
        </dd>
        {l ? (
          <>
            <dt className="text-muted-foreground">{tr("Licensed to")}</dt>
            <dd>{l.shop}</dd>
            <dt className="text-muted-foreground">{tr("Valid until")}</dt>
            <dd>{l.expiresAt}</dd>
            <dt className="text-muted-foreground">{tr("Computers")}</dt>
            <dd>{l.counters}</dd>
            <dt className="text-muted-foreground">{tr("Licence no.")}</dt>
            <dd className="font-mono">{l.id}</dd>
          </>
        ) : null}
      </dl>
      <p className="text-[11px] text-muted-foreground">
        {tr(
          "To buy or renew: send the machine code above to your MediCare provider. They send back a licence key — paste it below.",
        )}
      </p>

      <div className="space-y-2">
        <textarea
          value={key}
          onChange={(e) => setKey(e.target.value)}
          rows={3}
          spellCheck={false}
          placeholder="MC1.…"
          aria-label={tr("Licence key")}
          className={cn(
            fieldClass,
            "h-auto py-2 font-mono text-[11px] break-all",
          )}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !key.trim()}
            className="h-8 rounded-lg text-[11px] gap-1.5"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {tr("Save licence key")}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
