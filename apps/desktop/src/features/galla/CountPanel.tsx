import { useState } from "react";
import { toast } from "sonner";
import { Calculator, Coins, Lock, Minus, Plus } from "lucide-react";
import {
  COINS_KEY,
  countedTotal,
  DIFF_TOLERANCE_PAISE,
  NOTES,
} from "@medicare/domain/cash/galla";
import {
  inrFromPaise,
  paiseToInput,
  parseRupees,
} from "@medicare/domain/lib/money";
import { fieldClass } from "@/components/common/formStyles";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useGallaStore, type GallaView } from "./useGallaStore";
import { DiffBadge, MoneyInput, Panel } from "./parts";

/** Each note in roughly its real colour — found at a glance */
const NOTE_COLOR: Record<number, string> = {
  500: "bg-stone-400",
  200: "bg-orange-400",
  100: "bg-violet-400",
  50: "bg-cyan-500",
  20: "bg-lime-500",
  10: "bg-amber-700",
};

/**
 * Night: count the notes (pieces per note + coins), see short / excess at
 * once, decide what stays in the drawer for tomorrow, and close the day.
 * A difference needs a word of explanation.
 */
export function CountPanel({ view }: { view: GallaView }) {
  const close = useGallaStore((s) => s.close);
  const [pieces, setPieces] = useState<Record<string, number>>({});
  const [coins, setCoins] = useState("");
  const [kept, setKept] = useState(() =>
    paiseToInput(view.day?.openingPaise ?? view.suggestedOpeningPaise),
  );
  const [note, setNote] = useState("");
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  const denominations: Record<string, number> = {};
  for (const n of NOTES) {
    const v = pieces[String(n)] ?? 0;
    if (v > 0) denominations[String(n)] = v;
  }
  const coinPaise = parseRupees(coins || "0") ?? 0;
  if (coinPaise > 0) denominations[COINS_KEY] = coinPaise;
  const counted = countedTotal(denominations);
  const expected = view.summary.expectedPaise;
  const diff = counted - expected;
  const keptPaise = Math.min(parseRupees(kept || "0") ?? 0, counted);
  const off = Math.abs(diff) > DIFF_TOLERANCE_PAISE;
  const needsNote = off && !note.trim();
  const nothing = counted === 0 && expected !== 0;

  const setPiece = (n: number, v: number) =>
    setPieces({ ...pieces, [String(n)]: Math.max(0, Math.min(99_999, v)) });

  const doClose = async () => {
    setBusy(true);
    try {
      await close({
        countedPaise: counted,
        keptPaise,
        denominations,
        note: note.trim(),
      });
      toast.success(tr("Day closed"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Could not save"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      icon={Calculator}
      title="Count & close the day"
      hint="Count the notes in the galla — the difference shows at once"
      actions={counted > 0 ? <DiffBadge paise={diff} /> : null}
    >
      <div className="grid gap-x-6 px-4 py-2 sm:grid-cols-2">
        {NOTES.map((n) => {
          const k = String(n);
          const qty = pieces[k] ?? 0;
          return (
            <div
              key={n}
              className="flex items-center gap-2.5 border-b border-dashed border-border/70 py-1.5"
            >
              <span
                className={cn(
                  "flex h-5 w-10 shrink-0 items-center justify-center rounded text-[10.5px] font-bold text-white",
                  NOTE_COLOR[n],
                )}
              >
                ₹{n}
              </span>
              <div className="flex h-7 items-center rounded-md border border-border bg-background">
                <button
                  type="button"
                  aria-label={tr("One less ₹{{n}} note", { n })}
                  onClick={() => setPiece(n, qty - 1)}
                  disabled={!qty}
                  className="flex h-full w-6 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  inputMode="numeric"
                  aria-label={tr("Notes of ₹{{n}}", { n })}
                  value={qty || ""}
                  placeholder="0"
                  onChange={(e) =>
                    setPiece(
                      n,
                      parseInt(e.target.value.replace(/\D/g, "") || "0", 10),
                    )
                  }
                  className="h-full w-9 bg-transparent text-center text-[12px] font-medium tabular-nums outline-none"
                />
                <button
                  type="button"
                  aria-label={tr("One more ₹{{n}} note", { n })}
                  onClick={() => setPiece(n, qty + 1)}
                  className="flex h-full w-6 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <span
                className={cn(
                  "ml-auto text-[12px] tabular-nums",
                  !qty && "text-muted-foreground/60",
                )}
              >
                {qty ? inrFromPaise(qty * n * 100) : "—"}
              </span>
            </div>
          );
        })}
        <div className="flex items-center gap-2.5 py-1.5 sm:col-span-2">
          <span className="flex h-5 w-10 shrink-0 items-center justify-center rounded bg-yellow-400 text-amber-950">
            <Coins className="h-3 w-3" />
          </span>
          <span className="text-[12px]">{tr("Coins")}</span>
          <MoneyInput
            label={tr("Coins total")}
            value={coins}
            onChange={setCoins}
            className="ml-auto w-28"
          />
        </div>
      </div>

      <div className="grid items-end gap-3 border-t border-border bg-muted/30 px-4 py-3 sm:grid-cols-[auto_1fr_1.3fr]">
        <div className="pr-2">
          <p className="text-[10.5px] text-muted-foreground">{tr("Counted")}</p>
          <p className="text-[17px] font-bold leading-tight tabular-nums">
            {inrFromPaise(counted)}
          </p>
          <p className="text-[10.5px] text-muted-foreground">
            {tr("Should be {{amt}}", { amt: inrFromPaise(expected) })}
          </p>
        </div>
        <label className="block min-w-0">
          <span className="mb-1 block text-[10.5px] text-muted-foreground">
            {tr("Leave in galla for tomorrow")}
          </span>
          <MoneyInput
            id="galla-kept"
            label={tr("Leave in galla for tomorrow")}
            value={kept}
            onChange={setKept}
          />
        </label>
        <label className="block min-w-0">
          <span
            className={cn(
              "mb-1 block text-[10.5px]",
              needsNote && counted > 0
                ? "text-amber-700 dark:text-amber-400"
                : "text-muted-foreground",
            )}
          >
            {tr(off ? "Why short / excess? (needed)" : "Note (optional)")}
          </span>
          <input
            id="galla-note"
            value={note}
            maxLength={200}
            placeholder={tr("e.g. ₹50 change given extra")}
            onChange={(e) => setNote(e.target.value)}
            className={cn(
              fieldClass,
              "h-8",
              needsNote && counted > 0 && "border-amber-400",
            )}
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2">
        <p className="text-[10.5px] text-muted-foreground">
          {tr("Taken out (owner / bank): {{amt}}", {
            amt: inrFromPaise(counted - keptPaise),
          })}
        </p>
        <Button
          type="button"
          data-primary
          disabled={busy || needsNote || nothing}
          onClick={() => setAsk(true)}
          className="h-8 gap-1.5 rounded-lg px-4 text-[12px]"
        >
          <Lock className="h-3.5 w-3.5" />
          {tr("Close the day")}
        </Button>
      </div>

      <ConfirmDialog
        open={ask}
        tone="default"
        icon={Lock}
        title={tr("Close the day?")}
        description={tr(
          "Counted {{c}}, should be {{e}}. {{k}} stays in the galla for tomorrow.",
          {
            c: inrFromPaise(counted),
            e: inrFromPaise(expected),
            k: inrFromPaise(keptPaise),
          },
        )}
        confirmLabel={tr("Close the day")}
        cancelLabel={tr("Cancel")}
        onClose={() => setAsk(false)}
        onConfirm={() => {
          setAsk(false);
          void doClose();
        }}
      />
    </Panel>
  );
}
