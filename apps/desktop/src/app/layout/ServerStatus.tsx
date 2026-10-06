import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { useServerStore } from "@/stores/useServerStore";

const STYLE = {
  online: { dot: "bg-emerald-500", label: "Server connected" },
  checking: {
    dot: "bg-amber-400 animate-pulse",
    label: "Connecting to server…",
  },
  offline: { dot: "bg-red-500", label: "Server offline — click to retry" },
} as const;

/** Header light: is the app talking to the server? Click to reconnect. */
export function ServerStatus() {
  const status = useServerStore((s) => s.status);
  const error = useServerStore((s) => s.error);
  const sync = useServerStore((s) => s.sync);
  const st = STYLE[status];
  return (
    <button
      type="button"
      onClick={() => void sync()}
      disabled={status === "checking"}
      title={`${tr(st.label)}${error ? ` (${tr(error)})` : ""}`}
      aria-label={tr(st.label)}
      className="h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] text-muted-foreground hover:bg-muted transition-colors disabled:cursor-default"
    >
      <span className={cn("h-2 w-2 rounded-full", st.dot)} />
      <span className="hidden lg:inline">
        {tr(
          status === "online"
            ? "Server"
            : status === "offline"
              ? "Offline"
              : "Connecting",
        )}
      </span>
    </button>
  );
}
