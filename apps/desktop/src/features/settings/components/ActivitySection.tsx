import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/common/SearchInput";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { SettingsCard } from "./SettingsCard";

type Entry = {
  id: number;
  at: string;
  userName: string;
  action: string;
  detail: string;
  ip: string;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const LOCAL = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", ""]);
/** Changes the owner should notice at a glance */
const WATCH =
  /refused|wrong password|paused|deleted|cancelled|restored|reset|licence|adjusted/i;

/**
 * Owner: who did what, when, from which computer. Nobody can edit or
 * delete it from the app — useful to spot mistakes and misuse.
 */
export function ActivitySection() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [more, setMore] = useState(false);

  const load = useCallback(async (query: string, before = 0) => {
    try {
      const r = await apiGet<{ entries: Entry[]; more: boolean }>(
        `/api/audit?q=${encodeURIComponent(query)}&before=${before}`,
      );
      setRows((old) => (before && old ? [...old, ...r.entries] : r.entries));
      setMore(r.more);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <SettingsCard
      title="Activity log"
      description="Every sign-in, bill, return, stock change, price change, user change, backup and restore — who, when and from which computer."
    >
      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="Search name, action, bill no…"
      />
      <div className="overflow-x-auto rounded-lg border border-border max-h-[60vh] overflow-y-auto">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{tr("When")}</th>
              <th className="px-3 py-2 text-left font-medium">{tr("Who")}</th>
              <th className="px-3 py-2 text-left font-medium">{tr("What")}</th>
              <th className="px-3 py-2 text-left font-medium">
                {tr("Details")}
              </th>
              <th className="px-3 py-2 text-left font-medium">
                {tr("Computer")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-muted-foreground">
                  {tr("Loading…")}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-muted-foreground">
                  {tr("Nothing found")}
                </td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr
                  key={e.id}
                  className={cn(
                    "border-t border-border/60 align-top",
                    WATCH.test(e.action) &&
                      "bg-amber-50/60 dark:bg-amber-950/20",
                  )}
                >
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                    {when(e.at)}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {e.userName || "—"}
                  </td>
                  <td className="px-3 py-1.5">{tr(e.action)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {e.detail}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap font-mono text-[11px]">
                    {LOCAL.has(e.ip) ? tr("this computer") : e.ip}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {more && rows ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => void load(q, rows[rows.length - 1].id)}
            className="h-8 rounded-lg text-[11px]"
          >
            {tr("Show older")}
          </Button>
        </div>
      ) : null}
    </SettingsCard>
  );
}
