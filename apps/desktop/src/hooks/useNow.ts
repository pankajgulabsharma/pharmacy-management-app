import { useEffect, useState } from "react";

/**
 * Current time that refreshes every `intervalMs` (default 1 minute) —
 * keeps "10 min ago" and "today" correct while the screen stays open,
 * and keeps render pure (no Date.now() during render).
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
