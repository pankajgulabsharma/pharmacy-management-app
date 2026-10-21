import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAdding(adding === "in" ? null : "in")}
              className={cn(
                "h-9 gap-1.5 rounded-xl text-[12px]",
                adding === "in" &&
                  "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
              )}
            >
              <Plus className="h-4 w-4" />
              {tr("Cash in")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAdding(adding === "out" ? null : "out")}
              className={cn(
                "h-9 gap-1.5 rounded-xl text-[12px]",
                adding === "out" &&
                  "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
              )}
            >
              <Minus className="h-4 w-4" />
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
        <div className="mx-5 mb-5 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ArrowLeftRight className="h-5 w-5" />
          </span>
          <p className="max-w-sm text-[12px] text-muted-foreground">
            {tr(
              "No cash in or out yet. Tea, a supplier paid in cash, change added — note it here so the count matches.",
            )}
          </p>
        </div>
      ) : (
        <ul className="max-h-[360px] overflow-y-auto px-3 pb-3">
          {view.entries.map((e) => {
            const mine = e.by === me && e.date === businessDate();
            const removable =
              e.source === "manual" && !closed && (owner || mine);
            const isIn = e.kind === "in";
            return (
              <li
                key={e.id}
                className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    isIn
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                  )}
                >
                  {isIn ? (
                    <ArrowDownLeft className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {tr(e.category)}
                    {e.note ? (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {e.note}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                    <span className="tabular-nums">{time(e.at)}</span>
                    <span>·</span>
                    <span>{e.by}</span>
                    {SOURCE_HINT[e.source] ? (
                      <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium">
                        {tr(SOURCE_HINT[e.source])}
                      </span>
                    ) : null}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[13.5px] font-semibold tabular-nums",
                    isIn
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-rose-700 dark:text-rose-400",
                  )}
                >
                  {isIn ? "+" : "−"} {inrFromPaise(e.amountPaise)}
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
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="w-8 shrink-0" />
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
  const isIn = kind === "in";
  const save = async () => {
    const paise = parseRupees(amount);
    if (!paise || paise <= 0)
      return toast.error(tr("Type the amount in rupees, e.g. 2000"));
    setBusy(true);
    try {
      await add({ kind, category, amountPaise: paise, note: note.trim() });
      toast.success(isIn ? tr("Cash in noted") : tr("Cash out noted"));
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
        "mx-5 mb-4 rounded-2xl border p-4",
        isIn
          ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"
          : "border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12.5px] font-semibold">
          {tr(isIn ? "Put cash in the galla" : "Take cash out of the galla")}
        </p>
        <button
          type="button"
          onClick={onDone}
          aria-label={tr("Close")}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        role="radiogroup"
        aria-label={tr("Category")}
        className="mb-3 flex flex-wrap gap-1.5"
      >
        {list.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "h-8 rounded-full border px-3 text-[11.5px] font-medium transition",
              category === c
                ? isIn
                  ? "border-emerald-500 bg-emerald-600 text-white"
                  : "border-rose-500 bg-rose-600 text-white"
                : "border-border bg-background text-foreground hover:border-foreground/30",
            )}
          >
            {tr(c)}
          </button>
        ))}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-[140px_1fr_auto]">
        <MoneyInput
          label={tr("Amount")}
          value={amount}
          onChange={setAmount}
          autoFocus
        />
        <input
          aria-label={tr("Note")}
          placeholder={tr(
            isIn
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
          disabled={busy}
          className={cn(
            "h-9 rounded-xl px-5 text-[12.5px] text-white",
            isIn
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-rose-600 hover:bg-rose-700",
          )}
        >
          {tr("Save")}
        </Button>
      </div>
    </form>
  );
}
