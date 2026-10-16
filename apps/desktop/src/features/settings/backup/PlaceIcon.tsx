import { Cloud, HardDrive, Monitor, Usb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlaceKind } from "./types";

const ICON = { cloud: Cloud, drive: Usb, local: Monitor } as const;
const TONE: Record<PlaceKind, string> = {
  cloud: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400",
  drive:
    "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400",
  local: "bg-muted text-muted-foreground",
};

/** Round icon: cloud folder / pen drive / this computer */
export function PlaceIcon({
  kind,
  className,
}: {
  kind: PlaceKind | null;
  className?: string;
}) {
  const Icon = kind ? ICON[kind] : HardDrive;
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        TONE[kind ?? "local"],
        className,
      )}
      aria-hidden="true"
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}
