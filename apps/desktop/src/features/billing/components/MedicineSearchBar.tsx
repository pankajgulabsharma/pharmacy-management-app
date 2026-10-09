import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { Search, ScanBarcode, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { caretToEndOnFocusClick } from "@/lib/dom";

type Props = {
  query: string;
  onQueryChange: (v: string) => void;
  onClear: () => void;
  /** F2 focuses this */
  inputRef?: Ref<HTMLInputElement>;
};

export function MedicineSearchBar({
  query,
  onQueryChange,
  onClear,
  inputRef,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="relative shrink-0 p-0.5">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        type="text"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onMouseDown={caretToEndOnFocusClick}
        placeholder={t("billing.searchPlaceholder")}
        className={cn(
          "pl-9 pr-[120px] h-9 w-full rounded-lg !text-[11px] font-normal",
          "bg-muted/40 border border-border/50 shadow-none",
          "transition-colors",
          "placeholder:!text-[11px] placeholder:font-normal placeholder:text-muted-foreground",
          "hover:border-border hover:bg-muted/50",
          "focus-visible:outline-none focus-visible:ring-1",
          "focus-visible:ring-ring focus-visible:border-border",
          "focus-visible:bg-background",
        )}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {query ? (
          <button
            type="button"
            onClick={onClear}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
            aria-label="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {/* A USB barcode scanner types into this box and presses Enter */}
        <span
          className="p-1.5 text-muted-foreground"
          title="Barcode scanner works here — just scan the pack"
          aria-hidden="true"
        >
          <ScanBarcode className="h-3.5 w-3.5" />
        </span>
        <div className="hidden sm:flex items-center gap-1 rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          <span>↑↓</span>
          <span className="opacity-40">·</span>
          <span>Enter</span>
        </div>
      </div>
    </div>
  );
}
