import { useId } from "react";
import { Keyboard, X } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { Kbd } from "@/components/common/Kbd";
import { SHORTCUT_GROUPS } from "./registry";
import { useTr } from "@/hooks/useTr";

/** F1 — every shortcut in the app */
export function ShortcutsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const tr = useTr();
  const titleId = useId();
  if (!open) return null;
  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="max-w-4xl max-h-[88vh] flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Keyboard className="h-4 w-4" />
          </div>
          <div>
            <h2 id={titleId} className="text-sm font-semibold">
              Keyboard shortcuts
            </h2>
            <p className="text-[10px] text-muted-foreground">
              Run the whole shop without the mouse · press F1 any time
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4 columns-1 md:columns-2 gap-6">
        {SHORTCUT_GROUPS.map((g) => (
          <section key={tr(g.title)} className="mb-5 break-inside-avoid">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-1.5">
              {tr(g.title)}
            </h3>
            <ul className="divide-y divide-border/60">
              {g.rows.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 py-1.5 text-[12px]"
                >
                  <span className="text-foreground/90">{tr(r.label)}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {(typeof r.keys === "string" ? [r.keys] : r.keys).map(
                      (k, j) => (
                        <span key={k + j} className="flex items-center gap-1">
                          {j > 0 ? (
                            <span className="text-[10px] text-muted-foreground">
                              /
                            </span>
                          ) : null}
                          <Kbd keys={k} />
                        </span>
                      ),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ModalShell>
  );
}
