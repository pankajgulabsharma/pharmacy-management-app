import { Kbd } from "./Kbd";

export type KeyHint = { keys: string | readonly string[]; label: string };

/** Compact "[/] Search · [↑][↓] Move · [Enter] Open" strip for list screens */
export function KeyHints({ hints }: { hints: readonly KeyHint[] }) {
  return (
    <ul
      className="hidden md:flex items-center gap-3 text-[10px] text-muted-foreground"
      aria-label="Keyboard shortcuts"
    >
      {hints.map((h) => (
        <li key={h.label} className="inline-flex items-center gap-1">
          {(typeof h.keys === "string" ? [h.keys] : h.keys).map((k) => (
            <Kbd key={k} keys={k} />
          ))}
          <span>{h.label}</span>
        </li>
      ))}
      <li className="inline-flex items-center gap-1">
        <Kbd keys="F1" />
        <span>All shortcuts</span>
      </li>
    </ul>
  );
}
