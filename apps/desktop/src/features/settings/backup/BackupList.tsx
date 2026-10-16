import { useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { StatusBadge } from "@/components/common/StatusBadge";
import { apiDownload, apiRequest } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { showError } from "./useBackups";
import { fileSize, when, type Backup } from "./types";

const KIND: Record<
  Backup["kind"],
  { label: string; tone: "info" | "success" | "warning" | "neutral" }
> = {
  auto: { label: "Automatic", tone: "neutral" },
  manual: { label: "Manual", tone: "success" },
  "before-restore": { label: "Before restore", tone: "warning" },
  uploaded: { label: "From file", tone: "info" },
  "year-end": { label: "Year-end (kept)", tone: "success" },
};

/** Rows shown before "Show all" */
const FIRST = 6;

/** Every backup on this computer: download to a pen drive, or restore */
export function BackupList({
  backups,
  busy,
  run,
}: {
  backups: Backup[];
  busy: boolean;
  run: (fn: () => Promise<unknown>, done: string) => Promise<boolean>;
}) {
  const [all, setAll] = useState(false);
  const [restore, setRestore] = useState<Backup | null>(null);
  const shown = all ? backups : backups.slice(0, FIRST);

  return (
    <div className="space-y-2">
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
            {shown.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                  {tr("No backups yet")}
                </td>
              </tr>
            ) : (
              shown.map((b) => (
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
                    {fileSize(b.sizeBytes)}
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
      {backups.length > FIRST ? (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="text-[11px] font-medium text-primary hover:underline"
        >
          {all
            ? tr("Show fewer")
            : tr("Show all {{n}} backups", { n: backups.length })}
        </button>
      ) : null}

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
    </div>
  );
}
