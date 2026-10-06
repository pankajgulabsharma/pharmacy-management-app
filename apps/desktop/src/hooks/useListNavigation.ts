import { useCallback, useMemo, useState } from "react";
import { isTyping } from "@/lib/hotkeys";
import { useHotkeys } from "./useHotkeys";

type Options<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  /** Enter on the selected row */
  onOpen?: (item: T) => void;
  enabled?: boolean;
};

/**
 * Keyboard selection for a list/table:
 *   ↑ ↓      move (works from the search box too — type, then arrow down)
 *   Home End first / last (outside inputs)
 *   Enter    open the selected row
 * Selection follows the row's key, so filtering keeps it when possible.
 */
export function useListNavigation<T>({
  items,
  getKey,
  onOpen,
  enabled = true,
}: Options<T>) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const index = useMemo(
    () =>
      selectedKey === null
        ? -1
        : items.findIndex((i) => getKey(i) === selectedKey),
    [items, selectedKey, getKey],
  );
  const selected = index >= 0 ? items[index] : null;

  const selectIndex = useCallback(
    (i: number) => {
      if (items.length === 0) return;
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      setSelectedKey(getKey(items[clamped]));
    },
    [items, getKey],
  );

  const select = useCallback(
    (item: T | null) => setSelectedKey(item ? getKey(item) : null),
    [getKey],
  );

  /**
   * Arrowing out of the search box moves focus to the list, so row keys
   * (Enter, E, H, N, Delete…) work right away; "/" goes back to search.
   */
  const leaveInput = (e: KeyboardEvent) => {
    if (isTyping(e.target)) (e.target as HTMLElement).blur();
  };

  useHotkeys(
    [
      {
        keys: "ArrowDown",
        allowInInputs: true,
        handler: (e) => {
          leaveInput(e);
          selectIndex(index < 0 ? 0 : index + 1);
        },
      },
      {
        keys: "ArrowUp",
        allowInInputs: true,
        handler: (e) => {
          leaveInput(e);
          selectIndex(index < 0 ? 0 : index - 1);
        },
      },
      {
        keys: "PageDown",
        allowInInputs: true,
        handler: (e) => {
          leaveInput(e);
          selectIndex(index + 10);
        },
      },
      {
        keys: "PageUp",
        allowInInputs: true,
        handler: (e) => {
          leaveInput(e);
          selectIndex(index - 10);
        },
      },
      { keys: "Home", handler: () => selectIndex(0) },
      { keys: "End", handler: () => selectIndex(items.length - 1) },
      {
        keys: "Enter",
        allowInInputs: true,
        enabled: selected !== null && Boolean(onOpen),
        handler: () => selected && onOpen?.(selected),
      },
    ],
    enabled,
  );

  return {
    selected,
    selectedKey: selected ? selectedKey : null,
    select,
    selectIndex,
  };
}

/** Classes for the keyboard-selected row (one look across all tables) */
export const SELECTED_ROW =
  "!bg-primary/10 shadow-[inset_3px_0_0_0_var(--color-primary)]";
