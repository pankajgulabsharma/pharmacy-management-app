import { initials } from "@medicare/domain/auth/users";
import { cn } from "@/lib/utils";

/** Soft colours, picked from the person's id — the same every time */
const COLORS = [
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
];

const colorFor = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
};

export function PersonAvatar({
  id,
  name,
  size = "md",
}: {
  id: string;
  name: string;
  size?: "md" | "lg";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "lg" ? "h-16 w-16 text-xl" : "h-12 w-12 text-base",
        colorFor(id),
      )}
    >
      {initials(name)}
    </span>
  );
}
