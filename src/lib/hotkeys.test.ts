import { describe, expect, it } from "vitest";
import { formatCombo, isTyping, matchesCombo } from "./hotkeys";

const ev = (init: KeyboardEventInit & { code?: string }) =>
  ({
    key: "",
    code: "",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...init,
  }) as KeyboardEvent;

describe("hotkeys", () => {
  it("matches the bare + and - keys (bill quantity)", () => {
    expect(matchesCombo(ev({ key: "+", shiftKey: true }), "+")).toBe(true); // Shift+= on a laptop
    expect(matchesCombo(ev({ key: "+" }), "+")).toBe(true); // numpad +
    expect(matchesCombo(ev({ key: "-" }), "-")).toBe(true);
    expect(matchesCombo(ev({ key: "=" }), "+")).toBe(false);
  });

  it("matches F-keys, Alt+digit and Alt+letter by physical key", () => {
    expect(matchesCombo(ev({ key: "F9" }), "F9")).toBe(true);
    expect(
      matchesCombo(ev({ key: "¡", code: "Digit1", altKey: true }), "Alt+1"),
    ).toBe(true); // Mac Alt+1
    expect(
      matchesCombo(ev({ key: "®", code: "KeyR", altKey: true }), "Alt+R"),
    ).toBe(true); // Mac Alt+R
    expect(matchesCombo(ev({ key: "1", code: "Digit1" }), "Alt+1")).toBe(false);
  });

  it("letters ignore case but respect modifiers", () => {
    expect(matchesCombo(ev({ key: "n" }), "N")).toBe(true);
    expect(matchesCombo(ev({ key: "n", ctrlKey: true }), "N")).toBe(false);
  });

  it("formats combos for display", () => {
    expect(formatCombo("ArrowUp")).toEqual(["↑"]);
    expect(formatCombo("+")).toEqual(["+"]);
    expect(formatCombo("Home")).toEqual(["Home"]);
    expect(formatCombo("F9")).toEqual(["F9"]);
  });

  it("knows when the user is typing", () => {
    expect(
      isTyping({ tagName: "INPUT", type: "text" } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isTyping({
        tagName: "INPUT",
        type: "checkbox",
      } as unknown as EventTarget),
    ).toBe(false);
    expect(isTyping({ tagName: "BUTTON" } as unknown as EventTarget)).toBe(
      false,
    );
  });
});
