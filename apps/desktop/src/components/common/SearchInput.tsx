import { memo, type ComponentProps, type Ref } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { caretToEndOnFocusClick } from "@/lib/dom";
import { useTr } from "@/hooks/useTr";

const SIZE = {
  /** Page toolbars (Medicines, Inventory, Purchases) */
  md: {
    input: "h-9 !text-[12px] placeholder:!text-[12px] pl-9",
    icon: "left-3 h-3.5 w-3.5",
  },
  /** App header */
  lg: {
    input: "h-10 !text-[13px] placeholder:!text-[13px] pl-10",
    icon: "left-3 h-4 w-4",
  },
} as const;

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  maxLength?: number;
  size?: keyof typeof SIZE;
  /** Keyboard hint shown on the right while the box is empty, e.g. "⌘K" */
  shortcut?: string;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
  /** Extra attributes for the input (e.g. combobox ARIA, focus/keys handlers) */
  inputProps?: Omit<ComponentProps<"input">, "value" | "onChange" | "ref">;
};

/** Search box with icon, one clear (×) button and an optional shortcut hint */
export const SearchInput = memo(function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  maxLength = 80,
  size = "md",
  shortcut,
  inputRef,
  className,
  inputProps,
}: Props) {
  const tr = useTr();
  const s = SIZE[size];
  const hasValue = value.length > 0;

  return (
    <div className={cn("relative flex-1 min-w-0 p-0.5", className)}>
      <Search
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none",
          s.icon,
        )}
      />
      <Input
        {...inputProps}
        ref={inputRef}
        // type="text" (not "search") so the browser doesn't add its own second ×
        type="text"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onMouseDown={(e) => {
          inputProps?.onMouseDown?.(e);
          if (!e.defaultPrevented) caretToEndOnFocusClick(e);
        }}
        onKeyDown={(e) => {
          inputProps?.onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === "Escape" && hasValue) {
            e.stopPropagation();
            onChange("");
          }
        }}
        placeholder={tr(placeholder)}
        aria-label={ariaLabel ?? placeholder}
        maxLength={maxLength}
        className={cn(
          "w-full rounded-xl",
          "bg-muted/40 border border-border/50 shadow-none",
          "placeholder:text-muted-foreground",
          "hover:border-border hover:bg-muted/50",
          "focus-visible:outline-none focus-visible:ring-1",
          "focus-visible:ring-ring focus-visible:border-border",
          "focus-visible:bg-background",
          s.input,
          shortcut && !hasValue ? "pr-14" : "pr-8",
        )}
        autoComplete="off"
        spellCheck={false}
      />
      {hasValue ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      ) : shortcut ? (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-6 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
          {shortcut}
        </kbd>
      ) : null}
    </div>
  );
});
