import { cn } from "@/lib/utils";

/** 1 gold, 2 silver, 3 bronze, then grey — numbering for "top" lists */
export function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
        rank === 1
          ? "bg-amber-400/25 text-amber-700 dark:text-amber-300"
          : rank === 2
            ? "bg-slate-400/25 text-slate-700 dark:text-slate-300"
            : rank === 3
              ? "bg-orange-500/20 text-orange-700 dark:text-orange-300"
              : "bg-muted text-muted-foreground",
      )}
    >
      {rank}
    </span>
  );
}
