import { useState } from "react";
import { toast } from "sonner";
import { Copy, FolderOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { desktopBridge } from "@/lib/desktop";
import { tr } from "@/lib/i18n";
import { showError } from "./useBackups";
import { fileSize, type DataInfo } from "./types";

const COUNTS: { key: keyof DataInfo["counts"]; label: string }[] = [
  { key: "medicines", label: "Medicines" },
  { key: "bills", label: "Bills" },
  { key: "customers", label: "Customers" },
  { key: "purchases", label: "Purchases" },
  { key: "suppliers", label: "Suppliers" },
];

/**
 * The shop's data in one place: how much there is, how big, where it sits
 * on the main computer — every counter works on this same data.
 */
export function DataCard({ data }: { data: DataInfo }) {
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);
  const [confirm, setConfirm] = useState(false);
  const bridge = desktopBridge();

  return (
    <section className="rounded-xl border border-border p-4 space-y-3">
      <div>
        <h3 className="text-[13px] font-semibold">{tr("Your data")}</h3>
        <p className="text-[11px] text-muted-foreground">
          {tr(
            "Kept on the main computer — every counter works on the same data. Theme and language are kept per computer.",
          )}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {COUNTS.map((c) => (
          <div key={c.key} className="rounded-lg bg-muted/50 px-2.5 py-2">
            <dt className="text-[10px] text-muted-foreground">{tr(c.label)}</dt>
            <dd className="text-[15px] font-semibold tabular-nums">
              {data.counts[c.key].toLocaleString("en-IN")}
            </dd>
          </div>
        ))}
        <div className="rounded-lg bg-muted/50 px-2.5 py-2">
          <dt className="text-[10px] text-muted-foreground">{tr("Size")}</dt>
          <dd className="text-[15px] font-semibold tabular-nums">
            {fileSize(data.sizeBytes)}
          </dd>
        </div>
      </dl>
      {data.folder ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">{tr("Stored in")}:</span>
          <code className="min-w-0 break-all rounded bg-muted px-1.5 py-0.5 text-[10px]">
            {data.folder}
          </code>
          {bridge ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void bridge.openDataFolder()}
              className="h-7 rounded-md text-[11px] gap-1"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {tr("Open")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(data.folder)
                  .then(() => toast.success(tr("Copied")))
              }
              className="h-7 rounded-md text-[11px] gap-1"
            >
              <Copy className="h-3.5 w-3.5" />
              {tr("Copy")}
            </Button>
          )}
        </div>
      ) : null}
      <div className="border-t border-border pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirm(true)}
          className="h-8 rounded-lg text-[11px] gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {tr("Reset all settings to defaults")}
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title={tr("Reset all settings?")}
        description={tr(
          "Billing defaults, expiry windows, doctors, counters and role access go back to their original values. Your shop's name, address, GSTIN and licence are kept.",
        )}
        confirmLabel="Reset settings"
        onConfirm={() => {
          setConfirm(false);
          resetToDefaults().then(
            () => toast.success(tr("Settings reset to defaults")),
            showError,
          );
        }}
        onClose={() => setConfirm(false)}
      />
    </section>
  );
}
