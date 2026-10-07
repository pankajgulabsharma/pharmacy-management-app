import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, HardDriveDownload, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { StatusBadge } from "@/components/common/StatusBadge";
import { apiDownload, apiGet, apiRequest } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { SettingsCard } from "./SettingsCard";

type Backup = {
  name: string;
  kind: "auto" | "manual" | "before-restore" | "uploaded";
  sizeBytes: number;
  createdAt: string;
};

const KIND: Record<
  Backup["kind"],
  { label: string; tone: "info" | "success" | "warning" | "neutral" }
> = {
  auto: { label: "Automatic", tone: "neutral" },
  manual: { label: "Manual", tone: "success" },
  "before-restore": { label: "Before restore", tone: "warning" },
  uploaded: { label: "From file", tone: "info" },
};

const size = (b: number) =>
  b > 1_048_576
    ? `${(b / 1_048_576).toFixed(1)} MB`
    : `${Math.ceil(b / 1024)} KB`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const showError = (err: unknown) =>
  toast.error(err instanceof Error ? err.message : "Something went wrong");

/**
 * Owner: daily automatic backups, "Backup now", download to a pen drive,
 * bring a backup file back, and restore (with a safety copy first).
 */
export function BackupSection() {
  const [list, setList] = useState<Backup[] | null>(null);
  const [dir, setDir] = useState("");
  const [keepAuto, setKeepAuto] = useState(30);
  const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState<Backup | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    () =>
      apiGet<{ dir: string; keepAuto: number; backups: Backup[] }>(
        "/api/backups",
      ).then((r) => {
        setList(r.backups);
        setDir(r.dir);
        setKeepAuto(r.keepAuto);
      }, showError),
    [],
  );
  useEffect(() => void load(), [load]);

  /** Run one action, then refresh the list */
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(tr(done));
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };

  const lastAuto = list?.find((b) => b.kind === "auto");

  return (
    <SettingsCard
      title="Backup & restore"
      description="A full copy of the shop's data. Made automatically every day — keep one on a pen drive too."
    >
      <ul className="space-y-1 text-[11px] text-muted-foreground list-disc pl-4">
        <li>
          {tr("Last automatic backup")}:{" "}
          <b className="text-foreground">
            {lastAuto ? when(lastAuto.createdAt) : tr("not yet")}
          </b>{" "}
          · {tr("the last {{n}} are kept", { n: keepAuto })}
        </li>
        <li>
          {tr("Folder")}: <span className="font-mono break-all">{dir}</span>
        </li>
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy}
          onClick={() =>
            run(() => apiRequest("POST", "/api/backups"), "Backup saved")
          }
          className="h-8 rounded-lg text-[11px] gap-1.5"
        >
          <HardDriveDownload className="h-3.5 w-3.5" />
          {tr("Backup now")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="h-8 rounded-lg text-[11px] gap-1.5"
        >
          <Upload className="h-3.5 w-3.5" />
          {tr("Bring a backup file")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".sqlite"
          hidden
          aria-label={tr("Backup file")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file)
              void run(
                () => apiRequest("POST", "/api/backups/upload", file, 300_000),
                "Backup file added — you can restore it from the list",
              );
          }}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">
                {tr("Made on")}
              </th>
              <th className="px-3 py-2 text-left font-medium">{tr("Type")}</th>
              <th className="px-3 py-2 text-right font-medium">{tr("Size")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {list === null ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                  {tr("Loading…")}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                  {tr("No backups yet")}
                </td>
              </tr>
            ) : (
              list.map((b) => (
                <tr key={b.name} className="border-t border-border/60">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {when(b.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={KIND[b.kind].tone} shape="rounded">
                      {KIND[b.kind].label}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {size(b.sizeBytes)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        apiDownload(
                          `/api/backups/${encodeURIComponent(b.name)}/download`,
                          b.name,
                        ).catch(showError)
                      }
                      className="h-7 rounded-md text-[11px] gap-1"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {tr("Download")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setRestore(b)}
                      className="h-7 rounded-md text-[11px] gap-1 text-red-600 hover:text-red-700"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {tr("Restore")}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={restore !== null}
        title={tr("Restore the backup of {{date}}?", {
          date: restore ? when(restore.createdAt) : "",
        })}
        description={tr(
          "All data — bills, stock, purchases, customers, settings, users — goes back to that moment, on every counter. A safety copy of today's data is made first, so this can be undone.",
        )}
        confirmLabel="Restore"
        onConfirm={() => {
          const b = restore!;
          setRestore(null);
          void run(
            () =>
              apiRequest(
                "POST",
                `/api/backups/${encodeURIComponent(b.name)}/restore`,
                {},
                120_000,
              ),
            "Restored — every counter now shows the backup's data",
          );
        }}
        onClose={() => setRestore(null)}
      />
    </SettingsCard>
  );
}
