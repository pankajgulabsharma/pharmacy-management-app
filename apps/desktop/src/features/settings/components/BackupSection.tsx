import { useRef } from "react";
import { HardDriveDownload, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SettingsCard } from "./SettingsCard";
import { useBackups } from "../backup/useBackups";
import { OffsiteCard } from "../backup/OffsiteCard";
import { BackupList } from "../backup/BackupList";
import { DataCard } from "../backup/DataCard";
import { daysSince, fileSize, type Offsite } from "../backup/types";

/** "Today, 2:15 pm" / "Yesterday, 9:00 am" / "12 Oct, 9:00 am" */
function friendly(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return `${tr("Today")}, ${time}`;
  if (same(d, y)) return `${tr("Yesterday")}, ${time}`;
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${time}`;
}

function Tile({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "good" | "warn" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        tone === "good" &&
          "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20",
        tone === "warn" &&
          "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
        tone === "neutral" && "border-border",
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {tr(label)}
      </p>
      <p className="text-[14px] font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

/**
 * Owner: is the shop's data safe? Daily automatic backups on this
 * computer, a second copy outside it (Drive / pen drive), restore, and
 * what the data is.
 */
export function BackupSection() {
  const { data, busy, run } = useBackups();
  const fileRef = useRef<HTMLInputElement>(null);

  const newest = data?.backups.find((b) => b.kind !== "before-restore");
  const fresh = newest ? daysSince(newest.createdAt) < 2 : false;
  const total = data?.backups.reduce((s, b) => s + b.sizeBytes, 0) ?? 0;
  const off = data?.offsite;

  return (
    <SettingsCard
      title="Backup & data"
      description="A full copy of the shop's data is made by itself every day. Keep a second copy outside this computer too."
    >
      {data === null ? (
        <p className="text-[12px] text-muted-foreground">{tr("Loading…")}</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Tile
              label="Last backup"
              value={newest ? friendly(newest.createdAt) : tr("Not yet")}
              sub={tr("Automatic every day · last {{n}} kept", {
                n: data.keepAuto,
              })}
              tone={fresh ? "good" : "warn"}
            />
            <Tile
              label="Second copy"
              value={
                !off?.folder
                  ? tr("Not set up")
                  : !off.connected
                    ? tr("Not connected")
                    : off.lastCopyAt
                      ? friendly(off.lastCopyAt)
                      : tr("Not copied yet")
              }
              sub={
                off?.folder
                  ? tr(
                      off.kind === "cloud"
                        ? "Cloud folder"
                        : off.kind === "drive"
                          ? "Pen drive / other disk"
                          : "This computer's own disk",
                    )
                  : tr("Outside this computer")
              }
              tone={
                off?.folder && off.connected && !off.lastError ? "good" : "warn"
              }
            />
            <Tile
              label="Backups kept"
              value={String(data.backups.length)}
              sub={tr("{{size}} on this computer", { size: fileSize(total) })}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    apiRequest<{ offsite: Offsite }>("POST", "/api/backups"),
                  ({ offsite }) =>
                    !offsite.folder
                      ? "Backup saved on this computer"
                      : offsite.lastError
                        ? "Backup saved on this computer — the second copy is made when the drive is back"
                        : "Backup saved — and copied outside this computer",
                )
              }
              className="h-9 rounded-lg text-[12px] gap-1.5"
            >
              <HardDriveDownload className="h-4 w-4" />
              {tr("Backup now")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="h-9 rounded-lg text-[12px] gap-1.5"
            >
              <Upload className="h-4 w-4" />
              {tr("Bring a backup file")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".gz,.sqlite"
              hidden
              aria-label={tr("Backup file")}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file)
                  void run(
                    () =>
                      apiRequest("POST", "/api/backups/upload", file, 300_000),
                    "Backup file added — you can restore it from the list",
                  );
              }}
            />
          </div>

          {off ? (
            <OffsiteCard
              offsite={off}
              places={data.places}
              busy={busy}
              run={run}
            />
          ) : null}

          <div className="space-y-1.5">
            <h3 className="text-[13px] font-semibold">
              {tr("Backups on this computer")}
            </h3>
            <p className="text-[11px] text-muted-foreground font-mono break-all">
              {data.dir}
            </p>
            <BackupList backups={data.backups} busy={busy} run={run} />
          </div>

          <DataCard data={data.data} />
        </>
      )}
    </SettingsCard>
  );
}
