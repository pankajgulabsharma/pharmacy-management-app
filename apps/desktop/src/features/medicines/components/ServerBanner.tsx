import { RefreshCw, WifiOff } from "lucide-react";
import { tr } from "@/lib/i18n";
import { useServerStore } from "@/stores/useServerStore";

/** Shown only when the server can't be reached — never silently wrong data */
export function ServerBanner() {
  const status = useServerStore((s) => s.status);
  const error = useServerStore((s) => s.error);
  const sync = useServerStore((s) => s.sync);
  if (status !== "offline") return null;
  return (
    <div
      role="alert"
      className="shrink-0 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <p className="flex-1 min-w-0">
        <b>{tr(error ?? "Server not reachable")}</b> —{" "}
        {tr(
          "showing demo medicines; changes can't be saved. Start the server with",
        )}{" "}
        <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">
          npm run dev:server
        </code>
      </p>
      <button
        type="button"
        onClick={() => void sync()}
        className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 py-1 font-medium hover:bg-red-100 dark:border-red-800 dark:bg-transparent dark:hover:bg-red-900/40"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {tr("Retry")}
      </button>
    </div>
  );
}
