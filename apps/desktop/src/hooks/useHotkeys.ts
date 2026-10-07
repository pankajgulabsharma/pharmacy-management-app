import { useEffect, useRef } from "react";
import { isAnyModalOpen } from "@/lib/modalStack";
import { usePageActive } from "./usePageActive";
import { isTyping, matchesCombo } from "@/lib/hotkeys";

export type HotkeyBinding = {
  /** One combo or several alternatives, e.g. ["F2", "/"] */
  keys: string | readonly string[];
  handler: (e: KeyboardEvent) => void;
  /** Also fire while typing in an input (default: only F-keys / Mod / Alt combos do) */
  allowInInputs?: boolean;
  /** Also fire while a dialog is open (default false) */
  allowInModal?: boolean;
  enabled?: boolean;
  /** Extra condition checked before the key is taken (e.g. "search box is empty") */
  when?: (e: KeyboardEvent) => boolean;
};

/** Keys that never type text, so they are safe to use even inside inputs */
const SAFE_IN_INPUT = /^(F\d{1,2}|Mod\+|Alt\+|Escape$)/;

/**
 * Registers keyboard shortcuts for the lifetime of the component.
 * The latest handlers are always used (no stale closures), and only one
 * listener is attached per hook.
 */
export function useHotkeys(bindings: readonly HotkeyBinding[], enabled = true) {
  const ref = useRef(bindings);
  // A screen kept alive in the background doesn't take keys
  const active = usePageActive();
  enabled = enabled && active;
  useEffect(() => {
    ref.current = bindings;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const typing = isTyping(e.target);
      const modal = isAnyModalOpen();
      for (const b of ref.current) {
        if (b.enabled === false) continue;
        if (modal && !b.allowInModal) continue;
        const combos = typeof b.keys === "string" ? [b.keys] : b.keys;
        const hit = combos.find((c) => matchesCombo(e, c));
        if (!hit) continue;
        if (typing && !b.allowInInputs && !SAFE_IN_INPUT.test(hit)) continue;
        if (b.when && !b.when(e)) continue;
        e.preventDefault();
        b.handler(e);
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
