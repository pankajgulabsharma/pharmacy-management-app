import { useId, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fieldClass, invalidFieldClass } from "@/components/common/formStyles";
import { cleanText } from "@/lib/sanitize";

type Props = {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  maxItems: number;
  maxLength: number;
  /** At least this many items must remain */
  minItems?: number;
};

/** Add / remove text items (doctors, counters). Blocks blanks and duplicates. */
export function EditableList({
  label,
  items,
  onChange,
  placeholder,
  maxItems,
  maxLength,
  minItems = 0,
}: Props) {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const add = () => {
    const v = cleanText(value, maxLength);
    if (!v) return setError("Enter a name");
    if (items.some((x) => x.toLowerCase() === v.toLowerCase()))
      return setError("Already in the list");
    if (items.length >= maxItems) return setError(`Max ${maxItems}`);
    onChange([...items, v]);
    setValue("");
    setError("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // don't submit the surrounding form
      add();
    }
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-[11px] font-medium text-foreground"
      >
        {label}{" "}
        <span className="text-muted-foreground font-normal">
          ({items.length}/{maxItems})
        </span>
      </label>
      <div className="flex gap-2 p-0.5">
        <input
          id={id}
          value={value}
          maxLength={maxLength}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          onKeyDown={onKey}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className={cn(fieldClass, error && invalidFieldClass)}
        />
        <Button
          type="button"
          variant="outline"
          onClick={add}
          className="h-9 rounded-lg text-[11px] gap-1 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
      {error ? (
        <p className="text-[10px] text-red-500" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const locked = items.length <= minItems;
          return (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-2.5 pr-1 py-0.5 text-[11px]"
            >
              {item}
              <button
                type="button"
                disabled={locked}
                onClick={() => onChange(items.filter((x) => x !== item))}
                aria-label={`Remove ${item}`}
                title={locked ? `Keep at least ${minItems}` : "Remove"}
                className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          );
        })}
        {items.length === 0 ? (
          <li className="text-[11px] text-muted-foreground">None yet</li>
        ) : null}
      </ul>
    </div>
  );
}
