import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Plus, UserRoundX, X } from "lucide-react";
import { doctorDetails, doctorName } from "@medicare/domain/doctors/doctor";
import { SETTINGS_LIMITS } from "@medicare/domain/settings/types";
import { useCan } from "@/features/auth/store/useAuthStore";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Option =
  | { kind: "none" }
  | { kind: "doctor"; name: string }
  | { kind: "use"; name: string }
  | { kind: "save"; name: string };

/**
 * "Prescribed by": a real dropdown of the shop's doctors (search as you
 * type, ↑ ↓ Enter, Esc), their registration no. / clinic underneath —
 * or a doctor not in the list for this bill, which the owner can also
 * save to the list. Names are always written "Dr. Anita Mehta, MBBS".
 */
export function DoctorPicker({
  value,
  onChange,
  className,
  label,
  placeholder,
}: {
  value: string;
  onChange: (name: string) => void;
  className?: string;
  label: string;
  placeholder: string;
}) {
  const listId = useId();
  const doctors = useSettingsStore((s) => s.doctors);
  const info = useSettingsStore((s) => s.doctorInfo);
  const setDoctors = useSettingsStore((s) => s.setDoctors);
  const canSave = useCan("admin");
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const text = query ?? value;
  const typed = doctorName(text);
  const known = (n: string) =>
    doctors.find((d) => d.toLowerCase() === n.toLowerCase());

  const options = useMemo<Option[]>(() => {
    const q = (query ?? "")
      .trim()
      .toLowerCase()
      .replace(/^dr\.?\s*/, "");
    const list = doctors
      .filter((d) => !q || d.toLowerCase().includes(q))
      .map((name) => ({ kind: "doctor", name }) as Option);
    const out: Option[] = [];
    if (value) out.push({ kind: "none" });
    out.push(...list);
    if (query && typed && !known(typed)) {
      out.push({ kind: "use", name: typed });
      if (canSave && doctors.length < SETTINGS_LIMITS.maxDoctors)
        out.push({ kind: "save", name: typed });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctors, query, value, typed, canSave]);

  const show = () => {
    setOpen(true);
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.kind === "doctor" && o.name === value),
      ),
    );
  };
  const finish = (name: string) => {
    onChange(name);
    setQuery(null);
    setOpen(false);
  };
  const choose = (o: Option) => {
    if (o.kind === "none") return finish("");
    if (o.kind === "doctor" || o.kind === "use") return finish(o.name);
    // Save to Settings → Doctors, then use it
    void setDoctors([...doctors, o.name]).then(
      () =>
        toast.success(
          tr("{{name}} added to the doctors list", { name: o.name }),
        ),
      (e: Error) => toast.error(e.message),
    );
    finish(o.name);
  };
  // Leaving the box with typed text: use it, written the doctor way
  const commit = () => {
    if (query !== null) finish(query.trim() ? (known(typed) ?? typed) : "");
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + d + options.length) % Math.max(1, options.length));
    } else if (e.key === "Enter" && open && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setQuery(null);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        value={text}
        maxLength={SETTINGS_LIMITS.doctorMax}
        placeholder={placeholder}
        onFocus={show}
        onClick={show}
        onChange={(e) => {
          setQuery(e.target.value);
          // First match, not "No doctor"
          setActive(value ? 1 : 0);
          setOpen(true);
        }}
        onKeyDown={onKey}
        onBlur={commit}
        className={cn(className, "pl-3 pr-14 text-foreground")}
      />
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
        {value ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={tr("Clear doctor")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => finish("")}
            className="flex h-7 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          aria-label={tr("Show doctors")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) setOpen(false);
            else {
              inputRef.current?.focus();
              show();
            }
          }}
          className="flex h-7 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition", open && "rotate-180")}
          />
        </button>
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 min-w-[340px] overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {options.length === 0 ? (
            <li className="px-3 py-3 text-center text-[11px] text-muted-foreground">
              {doctors.length
                ? tr("No doctor matches — type the full name")
                : tr(
                    "No doctors yet — type a name, or add them in Settings → Doctors & counters",
                  )}
            </li>
          ) : null}
          {options.map((o, i) => {
            const on = i === active;
            const base = cn(
              "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left",
              on ? "bg-primary/10" : "hover:bg-muted",
            );
            if (o.kind === "none")
              return (
                <li
                  key="none"
                  role="option"
                  aria-selected={on}
                  className={base}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                >
                  <UserRoundX className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-[11.5px] text-muted-foreground">
                    {tr("No doctor (sale without prescription)")}
                  </span>
                </li>
              );
            if (o.kind === "use" || o.kind === "save")
              return (
                <li
                  key={o.kind}
                  role="option"
                  aria-selected={on}
                  className={cn(
                    base,
                    o.kind === "use" && "mt-1 border-t border-border pt-2",
                  )}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                >
                  <Plus className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 text-[11.5px]">
                    {o.kind === "use"
                      ? tr("Use “{{name}}” on this bill", { name: o.name })
                      : tr("Save “{{name}}” to the doctors list", {
                          name: o.name,
                        })}
                  </span>
                </li>
              );
            const details = doctorDetails(info[o.name]);
            const picked = o.name === value;
            return (
              <li
                key={o.name}
                role="option"
                aria-selected={on}
                className={base}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  {initialsOf(o.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium">
                    {o.name}
                  </span>
                  {details ? (
                    <span className="block truncate text-[10.5px] text-muted-foreground">
                      {details}
                    </span>
                  ) : null}
                </span>
                {picked ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** "Dr. Anita Mehta, MBBS" → "AM" */
function initialsOf(name: string) {
  const words = name
    .replace(/^Dr\.\s*/, "")
    .split(",")[0]
    .trim()
    .split(/\s+/);
  return (
    (words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")
  ).toUpperCase();
}
