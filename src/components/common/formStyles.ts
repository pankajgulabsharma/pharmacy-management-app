import { cn } from "@/lib/utils";

/** Standard form field (dialogs, filters) — matches Medicines / Inventory */
export const fieldClass = cn(
  "h-9 w-full min-w-0 rounded-lg !text-[12px]",
  "bg-muted/40 border border-border/50 shadow-none px-3",
  "placeholder:!text-[12px] placeholder:text-muted-foreground",
  "hover:border-border hover:bg-muted/50",
  "focus-visible:outline-none focus-visible:ring-1",
  "focus-visible:ring-ring focus-visible:border-border",
  "focus-visible:bg-background",
  "disabled:opacity-60 disabled:cursor-not-allowed",
);

/** Compact native input used inside editable table cells */
export const cellInputClass = cn(
  "h-7 w-full min-w-0 rounded-md px-2 text-[11px] text-foreground",
  "bg-muted/40 border border-border/50 outline-none transition-colors",
  "placeholder:text-muted-foreground/70",
  "hover:border-border",
  "focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-background",
);

/** Add to a field when it has a validation error */
export const invalidFieldClass =
  "!border-red-500/60 bg-red-50/50 dark:bg-red-950/20";
