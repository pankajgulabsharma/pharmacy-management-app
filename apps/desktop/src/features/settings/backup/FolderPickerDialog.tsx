import { useCallback, useEffect, useState } from "react";
import { ChevronRight, CornerLeftUp, Folder, Loader2 } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { DialogCloseButton } from "@/components/common/DialogCloseButton";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PlaceIcon } from "./PlaceIcon";
import type { Place } from "./types";

type Listing = { path: string; parent: string | null; folders: string[] };

/** "G:\My Drive\Shop" → ["G:\", "My Drive", "Shop"] with their full paths */
function crumbs(path: string) {
  const win = /^[A-Za-z]:\\/.test(path);
  const sepr = win ? "\\" : "/";
  const parts = path.split(/[\\/]+/).filter(Boolean);
  const out: { name: string; path: string }[] = [];
  let acc = win ? "" : "/";
  if (!win) out.push({ name: "/", path: "/" });
  for (const p of parts) {
    acc = win
      ? acc
        ? `${acc}${acc.endsWith(sepr) ? "" : sepr}${p}`
        : `${p}\\`
      : `${acc}${acc.endsWith("/") ? "" : "/"}${p}`;
    out.push({ name: p, path: acc });
  }
  return out;
}

const join = (dir: string, name: string) =>
  /[\\/]$/.test(dir)
    ? dir + name
    : `${dir}${/^[A-Za-z]:\\/.test(dir) ? "\\" : "/"}${name}`;

/**
 * Pick a folder ON THE MAIN COMPUTER (where the backups are written) —
 * works the same from the main computer or any counter. Drives and cloud
 * folders on the left, one click opens a folder, "Use this folder" picks it.
 */
export function FolderPickerDialog({
  places,
  onPick,
  onClose,
}: {
  places: Place[];
  onPick: (path: string) => void;
  onClose: () => void;
}) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchFolder = useCallback(
    (path: string) =>
      apiGet<Listing>(`/api/backups/browse?path=${encodeURIComponent(path)}`)
        .then(
          (l) => {
            setListing(l);
            setError("");
          },
          (err: unknown) =>
            setError(
              err instanceof Error ? err.message : "Can't open this folder",
            ),
        )
        .finally(() => setLoading(false)),
    [],
  );
  const open = (path: string) => {
    setLoading(true);
    void fetchFolder(path);
  };

  // The place the open folder is in (longest match: Drive inside home)
  const here = listing
    ? places
        .filter((p) => listing.path.startsWith(p.path))
        .sort((a, b) => b.path.length - a.path.length)[0]?.path
    : undefined;

  // Start at the best place (Google Drive first)
  useEffect(() => {
    if (places[0]) void fetchFolder(places[0].path);
  }, [places, fetchFolder]);

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy="folder-picker-title"
      className="max-w-2xl"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 id="folder-picker-title" className="text-sm font-semibold">
            {tr("Choose a folder for the second copy")}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {tr("Folders on the main computer — where MediCare keeps the data")}
          </p>
        </div>
        <DialogCloseButton onClick={onClose} />
      </div>

      <div className="grid grid-cols-[190px_1fr] min-h-[320px] max-h-[60vh]">
        <nav
          aria-label={tr("Places")}
          className="border-r border-border p-2 space-y-0.5 overflow-y-auto"
        >
          {places.map((p) => {
            const active = here === p.path;
            return (
              <button
                key={p.path}
                type="button"
                onClick={() => open(p.path)}
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left",
                  active ? "bg-primary/10" : "hover:bg-muted",
                )}
              >
                <PlaceIcon kind={p.kind} className="h-7 w-7" />
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-medium">
                    {tr(p.label)}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground font-mono">
                    {p.path}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex min-h-0 flex-col">
          <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-3 py-2 text-[11px]">
            {listing
              ? crumbs(listing.path).map((c, i, all) => (
                  <span key={c.path} className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => open(c.path)}
                      className={cn(
                        "rounded px-1 py-0.5 hover:bg-muted",
                        i === all.length - 1 && "font-semibold",
                      )}
                    >
                      {c.name}
                    </button>
                    {i < all.length - 1 ? (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    ) : null}
                  </span>
                ))
              : null}
            {loading ? (
              <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : null}
          </div>

          <ul
            className="flex-1 overflow-y-auto p-1.5"
            aria-label={tr("Folders")}
          >
            {listing?.parent ? (
              <li>
                <button
                  type="button"
                  onClick={() => open(listing.parent!)}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-muted"
                >
                  <CornerLeftUp className="h-4 w-4" />
                  {tr("Up one level")}
                </button>
              </li>
            ) : null}
            {error ? (
              <li className="px-2 py-6 text-center text-[12px] text-red-600">
                {tr(error)}
              </li>
            ) : listing && listing.folders.length === 0 ? (
              <li className="px-2 py-6 text-center text-[12px] text-muted-foreground">
                {tr("No folders inside — you can use this one")}
              </li>
            ) : (
              listing?.folders.map((f) => (
                <li key={f}>
                  <button
                    type="button"
                    onClick={() => open(join(listing.path, f))}
                    className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-muted"
                  >
                    <Folder className="h-4 w-4 shrink-0 fill-amber-200 text-amber-500 dark:fill-amber-500/30" />
                    <span className="truncate">{f}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <p className="min-w-0 truncate text-[11px] text-muted-foreground">
          {tr("A “MediCare Backups” folder is made inside it")}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 rounded-lg text-[12px]"
          >
            {tr("Cancel")}
          </Button>
          <Button
            type="button"
            data-primary
            disabled={!listing || !!error || loading}
            onClick={() => listing && onPick(listing.path)}
            className="h-9 rounded-lg text-[12px]"
          >
            {tr("Use this folder")}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
