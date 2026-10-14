import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { LibraryItem } from "@medicare/domain/medicines/library";

type Result = {
  items: LibraryItem[];
  /** "building" on the very first start, for a few seconds */
  status: "ready" | "building" | "missing";
};
const NONE: Result = { items: [], status: "ready" };

/**
 * Medicine Library matches for what was typed (2+ letters), asked from
 * the server a moment after typing stops. Off when `enabled` is false.
 */
export function useLibrarySearch(q: string, enabled = true, limit = 8) {
  const query = q.trim();
  const on = enabled && query.length >= 2;
  const [result, setResult] = useState<Result & { for: string }>({
    ...NONE,
    for: "",
  });

  useEffect(() => {
    if (!on) return;
    let stale = false;
    const t = setTimeout(() => {
      apiGet<Result>(
        `/api/library/search?q=${encodeURIComponent(query.slice(0, 80))}&limit=${limit}`,
      )
        .then((r) => !stale && setResult({ ...r, for: query }))
        // Library is a helper — no library, no suggestions (never an error)
        .catch(() => !stale && setResult({ ...NONE, for: query }));
    }, 200);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [on, query, limit]);

  // Only answers for what is typed now (no flash of old results)
  return on && result.for === query ? result : NONE;
}
