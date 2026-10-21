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
  500: "from-stone-400 to-stone-500",
  200: "from-amber-400 to-orange-500",
  100: "from-violet-400 to-purple-500",
  50: "from-cyan-400 to-sky-500",
  20: "from-lime-400 to-green-500",
  10: "from-amber-600 to-amber-800",
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
    >
      <div className="grid gap-2.5 px-5 pb-4 sm:grid-cols-2">
        {NOTES.map((n) => {
          const k = String(n);
          const qty = pieces[k] ?? 0;
          return (
            <div
              key={n}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-2.5 py-2 transition",
                qty ? "border-primary/30 bg-primary/[0.04]" : "border-border",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-14 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-[12px] font-bold text-white shadow-sm ring-1 ring-black/5",
                  NOTE_COLOR[n],
                )}
              >
                ₹{n}
              </span>
              <div className="flex items-center rounded-lg border border-border bg-background">
                <button
                  type="button"
                  aria-label={tr("One less ₹{{n}} note", { n })}
                  onClick={() => setPiece(n, qty - 1)}
                  disabled={!qty}
                  className="flex h-8 w-7 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" />
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
                  className="h-8 w-11 bg-transparent text-center text-[13px] font-semibold tabular-nums outline-none"
                />
                <button
                  type="button"
                  aria-label={tr("One more ₹{{n}} note", { n })}
                  onClick={() => setPiece(n, qty + 1)}
                  className="flex h-8 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <span
                className={cn(
                  "ml-auto text-[12.5px] tabular-nums",
                  qty ? "font-semibold" : "text-muted-foreground",
                )}
              >
                {qty ? inrFromPaise(qty * n * 100) : "—"}
              </span>
            </div>
          );
        })}
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border px-2.5 py-2 sm:col-span-2",
            coinPaise ? "border-primary/30 bg-primary/[0.04]" : "border-border",
          )}
        >
          <span className="flex h-8 w-14 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-950 shadow-sm ring-1 ring-black/5">
            <Coins className="h-4 w-4" />
          </span>
          <span className="text-[12.5px] font-medium">{tr("Coins")}</span>
          <MoneyInput
            label={tr("Coins total")}
            value={coins}
            onChange={setCoins}
            className="ml-auto w-32"
          />
        </div>
      </div>

      {/* The result: counted vs should be */}
      <div className="mx-5 mb-4 rounded-2xl border border-border bg-muted/30 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] text-muted-foreground">{tr("Counted")}</p>
            <p className="text-[26px] font-bold leading-tight tabular-nums">
              {inrFromPaise(counted)}
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              {tr("Should be {{amt}}", { amt: inrFromPaise(expected) })}
            </p>
          </div>
          {counted > 0 ? <DiffBadge paise={diff} size="lg" /> : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium">
              {tr("Leave in galla for tomorrow")}
            </span>
            <MoneyInput
              id="galla-kept"
              label={tr("Leave in galla for tomorrow")}
              value={kept}
              onChange={setKept}
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {tr("Taken out (owner / bank): {{amt}}", {
                amt: inrFromPaise(counted - keptPaise),
              })}
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium">
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
                needsNote &&
                  counted > 0 &&
                  "border-amber-400 ring-1 ring-amber-300/60",
              )}
            />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/20 px-5 py-3">
        {needsNote && counted > 0 ? (
          <p className="mr-auto text-[11.5px] text-amber-700 dark:text-amber-400">
            {tr("Write why the cash is short / excess, then close.")}
          </p>
        ) : null}
        <Button
          type="button"
          data-primary
          disabled={busy || needsNote || nothing}
          onClick={() => setAsk(true)}
          className="h-10 gap-2 rounded-xl px-5 text-[13px]"
        >
          <Lock className="h-4 w-4" />
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
