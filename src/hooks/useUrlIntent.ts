import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Reads one-time instructions from the URL (e.g. /inventory?status=low,
 * /purchases?new=1) and then removes them, so a refresh doesn't repeat
 * the action. Lets the Dashboard deep-link to a filtered screen.
 */
export function useUrlIntent(): Readonly<Record<string, string>> {
  const [params, setParams] = useSearchParams();
  const [intent] = useState(() => Object.fromEntries(params.entries()));
  const cleared = useRef(false);

  useEffect(() => {
    if (cleared.current) return;
    cleared.current = true;
    if ([...params.keys()].length > 0) setParams({}, { replace: true });
  }, [params, setParams]);

  return intent;
}

/** Narrow a URL value to one of the allowed options (never trust the URL) */
export function oneOf<T extends string>(
  value: string | undefined,
  options: readonly T[],
  fallback: T,
): T {
  return value && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}
