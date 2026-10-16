import { useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  FolderOpen,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { OFFSITE_STALE_DAYS } from "./useBackupHealth";
import { FolderPickerDialog } from "./FolderPickerDialog";
import { PlaceIcon } from "./PlaceIcon";
import { daysSince, when, type Offsite, type Place } from "./types";

type Run = (fn: () => Promise<unknown>, done: string) => Promise<boolean>;

const HINT: Record<Place["kind"], string> = {
  cloud: "Free · goes online by itself",
  drive: "Pen drive / other disk",
  local: "This computer's own disk",
};

/** The place a folder is in (Google Drive inside home → Google Drive) */
const placeOf = (folder: string, places: Place[]) =>
  places
    .filter((p) => folder.startsWith(p.path))
    .sort((a, b) => b.path.length - a.path.length)[0];

/**
 * A copy of every backup OUTSIDE this computer — the only thing that saves
 * the shop if the computer is stolen or breaks. One click on Google Drive /
 * a pen drive; after that it happens by itself.
 */
export function OffsiteCard({
  offsite,
  places,
  busy,
  run,
}: {
  offsite: Offsite;
  places: Place[];
  busy: boolean;
  run: Run;
}) {
  const [picking, setPicking] = useState(false);
  const save = (folder: string) =>
    run(
      () => apiRequest("PUT", "/api/backups/offsite", { folder }),
      folder
        ? "Done — the latest backup is copied there, and every new one too"
        : "Second copy switched off",
    );
  const pick = (folder: string) => {
    setPicking(false);
    void save(folder);
  };

  const outside = places.filter((p) => p.kind !== "local");
  const hasCloud = outside.some((p) => p.kind === "cloud");
  const set = !!offsite.folder;
  const age = offsite.lastCopyAt ? daysSince(offsite.lastCopyAt) : null;
  const ok =
    set &&
    offsite.connected &&
    !offsite.lastError &&
    age !== null &&
    age < OFFSITE_STALE_DAYS;

  return (
    <section
      className={cn(
        "rounded-xl border p-4 space-y-3",
        ok
          ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"
          : "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
      )}
      aria-labelledby="offsite-title"
    >
      <div className="flex items-start gap-3">
        {ok ? (
          <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
        ) : (
          <ShieldAlert className="h-6 w-6 shrink-0 text-amber-600" />
        )}
        <div className="min-w-0">
          <h3 id="offsite-title" className="text-[13px] font-semibold">
            {tr("Second copy outside this computer")}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {set
              ? tr(
                  "Every backup is also copied here by itself. If this computer is stolen or breaks, the shop comes back from this copy.",
                )
              : tr(
                  "Not set up yet. If this computer is stolen or breaks, the data on it is gone. Pick a place once — every backup is copied there by itself.",
                )}
          </p>
        </div>
      </div>

      {set ? (
        <ChosenFolder
          offsite={offsite}
          place={placeOf(offsite.folder, places)}
          ok={ok}
          age={age}
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {outside.map((p, i) => (
            <button
              key={p.path}
              type="button"
              disabled={busy}
              onClick={() => void save(p.path)}
              className="group relative flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary hover:shadow-sm disabled:opacity-60"
            >
              <PlaceIcon kind={p.kind} />
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold">
                  {tr(p.label)}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  {tr(HINT[p.kind])}
                </span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                  {p.path}
                </span>
              </span>
              {i === 0 && p.kind === "cloud" ? (
                <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground">
                  {tr("Recommended")}
                </span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => setPicking(true)}
            className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/60 p-3 text-left hover:border-primary hover:bg-card disabled:opacity-60"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </span>
            <span>
              <span className="block text-[12px] font-semibold">
                {tr("Other folder…")}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                {tr("Browse drives and folders")}
              </span>
            </span>
          </button>
        </div>
      )}

      {!set && !hasCloud ? (
        <p className="flex gap-2 rounded-lg bg-card/70 p-2.5 text-[11px] text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 text-sky-600" />
          <span>
            {tr(
              "Google Drive isn't on this computer yet. Install the free “Google Drive for desktop”, sign in with the shop's Gmail (15 GB free) — it then shows here for one click.",
            )}
          </span>
        </p>
      ) : null}

      {set ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || !offsite.connected}
            onClick={() =>
              void run(
                () => apiRequest("POST", "/api/backups/offsite/copy"),
                "Copied",
              )
            }
            className="h-8 rounded-lg text-[11px] gap-1.5 bg-card"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {tr("Copy now")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setPicking(true)}
            className="h-8 rounded-lg text-[11px] gap-1.5 bg-card"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {tr("Change folder")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => void save("")}
            className="h-8 rounded-lg text-[11px] gap-1.5 text-muted-foreground"
          >
            <Unplug className="h-3.5 w-3.5" />
            {tr("Turn off")}
          </Button>
        </div>
      ) : null}

      {picking ? (
        <FolderPickerDialog
          places={places}
          onPick={pick}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </section>
  );
}

function ChosenFolder({
  offsite,
  place,
  ok,
  age,
}: {
  offsite: Offsite;
  place: Place | undefined;
  ok: boolean;
  age: number | null;
}) {
  const status = !offsite.connected
    ? {
        tone: "amber",
        text: tr(
          "Not connected right now — the copy is made by itself as soon as it is back",
        ),
      }
    : offsite.lastError
      ? { tone: "red", text: tr(offsite.lastError) }
      : ok
        ? {
            tone: "green",
            text: tr("Copied {{date}}", { date: when(offsite.lastCopyAt!) }),
          }
        : {
            tone: "amber",
            text:
              age === null
                ? tr("Not copied yet")
                : tr("Last copied {{n}} days ago", { n: age }),
          };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <PlaceIcon kind={offsite.kind} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold">
            {tr(
              place?.label ??
                (offsite.kind === "drive"
                  ? "Pen drive"
                  : offsite.kind === "cloud"
                    ? "Cloud folder"
                    : "Folder"),
            )}
          </p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {offsite.target || offsite.folder}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
            status.tone === "green" &&
              "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
            status.tone === "amber" &&
              "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
            status.tone === "red" &&
              "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
          )}
        >
          {status.tone === "green" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <CircleAlert className="h-3.5 w-3.5" />
          )}
          {status.text}
        </span>
      </div>
      {offsite.kind === "local" ? (
        <p className="flex gap-2 text-[11px] text-amber-800 dark:text-amber-400">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {tr(
            "This folder is on this computer's own disk — it won't help if the computer is stolen or breaks. Choose Google Drive or a pen drive.",
          )}
        </p>
      ) : offsite.kind === "drive" ? (
        <p className="flex gap-2 text-[11px] text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" />
          {tr(
            "Plug the pen drive in every few days — the newest backup is copied by itself within 2 minutes. Keep it away from the shop at night.",
          )}
        </p>
      ) : null}
    </div>
  );
}
