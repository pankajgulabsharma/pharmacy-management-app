/**
 * Keyboard shortcut helpers.
 *
 * Combos are written like "F9", "Alt+1", "Mod+Enter", "Shift+?", "/", "Delete".
 * "Mod" = Ctrl on Windows/Linux, ⌘ on Mac. Digits use the physical key
 * (event.code), so Alt+1 works on Mac too (where Alt+1 types "¡").
 */
export const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

type Parsed = { key: string; mod: boolean; alt: boolean; shift: boolean };

const cache = new Map<string, Parsed>();

function parse(combo: string): Parsed {
  let p = cache.get(combo);
  if (!p) {
    // The "+" key itself: "+" alone, or "Shift++" / "Mod++"
    const plusKey = combo === "+" || combo.endsWith("++");
    const parts = (plusKey ? combo.slice(0, -1) : combo)
      .split("+")
      .filter(Boolean);
    const key = plusKey ? "+" : (parts.pop() ?? "");
    p = {
      key: key.toLowerCase(),
      mod: parts.includes("Mod"),
      alt: parts.includes("Alt"),
      shift: parts.includes("Shift"),
    };
    cache.set(combo, p);
  }
  return p;
}

/** Does this keyboard event match the combo? */
export function matchesCombo(e: KeyboardEvent, combo: string): boolean {
  const p = parse(combo);
  const mod = IS_MAC ? e.metaKey : e.ctrlKey;
  if (p.mod !== mod || p.alt !== e.altKey) return false;
  // Shift is significant only for letters/F-keys/named keys we declared with it
  const isDigit = /^\d$/.test(p.key);
  if (isDigit) return e.code === `Digit${p.key}` && p.shift === e.shiftKey;
  // Alt+letter: physical key (on Mac, Alt+R types "®")
  if (p.alt && /^[a-z]$/.test(p.key)) {
    return e.code === `Key${p.key.toUpperCase()}` && p.shift === e.shiftKey;
  }
  const key = e.key.toLowerCase();
  if (p.key.length === 1 && !/[a-z0-9]/.test(p.key)) {
    // Symbols like "?", "/", "+", "-": the produced character decides
    return key === p.key;
  }
  return key === p.key && p.shift === e.shiftKey;
}

/** True when the user is typing in a field (shortcuts should not hijack it) */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.tagName !== "INPUT") return false;
  const type = (el as HTMLInputElement).type;
  return !["button", "checkbox", "radio", "submit", "reset"].includes(type);
}

/** "Mod+Enter" → "Ctrl Enter" / "⌘ Enter" for display */
export function formatCombo(combo: string): string[] {
  const p = parse(combo);
  const parts: string[] = [];
  if (p.mod) parts.push(IS_MAC ? "⌘" : "Ctrl");
  if (p.alt) parts.push(IS_MAC ? "⌥" : "Alt");
  if (p.shift && p.key !== "?") parts.push("Shift");
  const names: Record<string, string> = {
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    enter: "Enter",
    escape: "Esc",
    delete: "Del",
    backspace: "Backspace",
    home: "Home",
    end: "End",
    tab: "Tab",
    pageup: "PgUp",
    pagedown: "PgDn",
    " ": "Space",
  };
  // Letters and F-keys in capitals (N, F9); named keys in Title case
  const upper = p.key.length === 1 || /^f\d{1,2}$/.test(p.key);
  parts.push(
    names[p.key] ??
      (upper ? p.key.toUpperCase() : p.key[0].toUpperCase() + p.key.slice(1)),
  );
  return parts;
}

/**
 * The combo to SHOW on this computer: on a Mac prefer a non-F-key partner
 * (F-keys need fn there); elsewhere show the first one.
 */
export function preferredCombo(keys: string | readonly string[]): string {
  const list = typeof keys === "string" ? [keys] : keys;
  if (IS_MAC) return list.find((k) => !/^F\d{1,2}$/.test(k)) ?? list[0];
  return list[0];
}
