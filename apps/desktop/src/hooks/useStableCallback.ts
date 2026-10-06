import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Returns a function with a stable identity that always calls the latest
 * `fn`. Lets memoized rows/children skip re-rendering even when the parent
 * passes a new inline callback on every render.
 */
export function useStableCallback<Args extends unknown[], R>(
  fn: (...args: Args) => R,
): (...args: Args) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  }, [fn]);
  return useCallback((...args: Args) => ref.current(...args), []);
}
