import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Minus, Plus, Trash2 } from "lucide-react";
import {
  businessDate,
  CASH_IN_CATEGORIES,
  CASH_OUT_CATEGORIES,
  type CashEntry,
  type CashKind,
} from "@medicare/domain/cash/galla";
import { inrFromPaise, parseRupees } from "@medicare/domain/lib/money";
import { fieldClass } from "@/components/common/formStyles";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useGallaStore, type GallaView } from "./useGallaStore";
import { MoneyInput, Panel } from "./parts";
import { time } from "./format";

const SOURCE_HINT: Record<CashEntry["source"], string> = {
  manual: "",
  refund: "Sales return",
  udhaar: "Udhaar payment",
  supplier: "Purchases",
};

/**
 * Cash put in / taken out of the drawer: typed here (change added, tea,
 * salary advance, bank deposit…) or written by the app (cash refunds,
 * udhaar paid in cash, a supplier paid from the galla).
 */
export function EntriesPanel({
  view,
  owner,
  isToday,
}: {
  view: GallaView;
  owner: boolean;
  isToday: boolean;
}) {
  const remove = useGallaStore((s) => s.removeEntry);
  const me = useAuthStore((s) => s.session?.user.name);
  const [adding, setAdding] = useState<CashKind | null>(null);
  const closed = view.day?.status === "closed";
  const canAdd = !closed && (isToday || owner);

  return (
    <Panel
      icon={ArrowLeftRight}
      title="Cash in / out"
      hint="Everything that went into or out of the drawer, besides bills"
      actions={
        canAdd ? (
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={adding === "in" ? "default" : "outline"}
              onClick={() => setAdding(adding === "in" ? null : "in")}
              className="h-8 gap-1 rounded-lg text-[11px]"
            >
              <Plus className="h-3.5 w-3.5" />
              {tr("Cash in")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={adding === "out" ? "default" : "outline"}
              onClick={() => setAdding(adding === "out" ? null : "out")}
              className="h-8 gap-1 rounded-lg text-[11px]"
            >
              <Minus className="h-3.5 w-3.5" />
              {tr("Cash out")}
            </Button>
          </div>
        ) : null
      }
    >
      {adding ? (
        <AddEntry kind={adding} onDone={() => setAdding(null)} />
      ) : null}
      {view.entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-[11.5px] text-muted-foreground">
          {tr(
            "No cash in or out yet. Tea, a supplier paid in cash, change added — note it here so the count matches.",
          )}
        </p>
      ) : (
        <ul className="max-h-[340px] divide-y divide-border/70 overflow-y-auto">
          {view.entries.map((e) => {
            const mine = e.by === me && e.date === businessDate();
            const removable =
              e.source === "manual" && !closed && (owner || mine);
            return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2">
                <span className="w-14 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {time(e.at)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium">
                    {tr(e.category)}
                    {e.note ? (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {e.note}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-[10.5px] text-muted-foreground">
                    {e.by}
                    {SOURCE_HINT[e.source]
                      ? ` · ${tr(SOURCE_HINT[e.source])}`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[12.5px] font-semibold tabular-nums",
                    e.kind === "in"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400",
                  )}
                >
                  {e.kind === "in" ? "+" : "−"} {inrFromPaise(e.amountPaise)}
                </span>
                {removable ? (
                  <button
                    type="button"
                    aria-label={tr("Remove {{what}}", { what: tr(e.category) })}
                    title={tr("Remove (typed by mistake)")}
                    onClick={() =>
                      void remove(e.id).catch((err) =>
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : tr("Could not save"),
                        ),
                      )
                    }
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className="w-7 shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function AddEntry({ kind, onDone }: { kind: CashKind; onDone: () => void }) {
  const add = useGallaStore((s) => s.addEntry);
  const list: readonly string[] =
    kind === "in" ? CASH_IN_CATEGORIES : CASH_OUT_CATEGORIES;
  const [category, setCategory] = useState(list[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const paise = parseRupees(amount);
    if (!paise || paise <= 0)
      return toast.error(tr("Type the amount in rupees, e.g. 2000"));
    setBusy(true);
    try {
      await add({ kind, category, amountPaise: paise, note: note.trim() });
      toast.success(kind === "in" ? tr("Cash in noted") : tr("Cash out noted"));
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Could not save"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className={cn(
        "grid gap-2 border-b border-border px-4 py-3 sm:grid-cols-[150px_120px_1fr_auto]",
        kind === "in"
          ? "bg-emerald-50/50 dark:bg-emerald-950/20"
          : "bg-rose-50/50 dark:bg-rose-950/20",
      )}
    >
      <select
        aria-label={tr("Category")}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className={fieldClass}
      >
        {list.map((c) => (
          <option key={c} value={c}>
            {tr(c)}
          </option>
        ))}
      </select>
      <MoneyInput
        label={tr("Amount")}
        value={amount}
        onChange={setAmount}
        autoFocus
      />
      <input
        aria-label={tr("Note")}
        placeholder={tr(
          kind === "in"
            ? "Note (optional)"
            : "What for? e.g. tea, courier, Ravi's advance",
        )}
        value={note}
        maxLength={120}
        onChange={(e) => setNote(e.target.value)}
        className={fieldClass}
      />
      <Button
        type="submit"
        data-primary
        disabled={busy}
        className="h-9 rounded-lg text-[12px]"
      >
        {tr("Save")}
      </Button>
    </form>
  );
}
