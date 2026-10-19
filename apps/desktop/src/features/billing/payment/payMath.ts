import { cn } from "@/lib/utils";

/** Small money boxes in the payment panel */
export const PAY_INPUT = cn(
  "h-8 w-full rounded-md !text-[11px] leading-none tabular-nums",
  "bg-muted/40 border border-border/50 shadow-none",
  "placeholder:!text-[10px] placeholder:text-muted-foreground",
  "hover:border-border hover:bg-muted/50",
  "focus-visible:outline-none focus-visible:ring-1",
  "focus-visible:ring-ring focus-visible:border-border",
  "focus-visible:bg-background",
);

/** Notes a customer is likely to hand over for this total */
export function quickCash(net: number): number[] {
  if (net <= 0) return [];
  const rupees = Math.ceil(net / 100);
  const out = new Set<number>([net]);
  for (const step of [10, 50, 100, 500])
    out.add(Math.ceil(rupees / step) * step * 100);
  for (const note of [100, 200, 500, 2000])
    if (note * 100 > net) out.add(note * 100);
  return [...out].sort((a, b) => a - b).slice(0, 4);
}
