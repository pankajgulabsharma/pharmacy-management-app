/** "1 bill" / "3 bills" / "1 batch" / "2 batches" */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * % change vs a previous value, rounded. null when there is nothing to
 * compare against (previous was 0) — show "—", never "+∞%".
 */
export function percentChange(now: number, before: number): number | null {
  return before > 0 ? Math.round(((now - before) / before) * 100) : null;
}
