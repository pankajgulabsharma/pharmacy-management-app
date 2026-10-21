import { useState } from "react";
import { toast } from "sonner";
import { Calculator, Lock } from "lucide-react";
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

/**
 * Night: count the notes (pieces per note + coins), see short / excess at
 * once, decide what stays in the drawer for tomorrow, and close the day.
 * A difference needs a word of explanation.
 */
export function CountPanel({ view }: { view: GallaView }) {
  const close = useGallaStore((s) => s.close);
  const [pieces, setPieces] = useState<Record<string, string>>({});
  const [coins, setCoins] = useState("");
  const [kept, setKept] = useState(() =>
    paiseToInput(view.day?.openingPaise ?? view.suggestedOpeningPaise),
  );
  const [note, setNote] = useState("");
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  const denominations: Record<string, number> = {};
  for (const n of NOTES) {
    const v = parseInt(pieces[String(n)] ?? "", 10);
    if (v > 0) denominations[String(n)] = v;
  }
  const coinPaise = parseRupees(coins || "0") ?? 0;
  if (coinPaise > 0) denominations[COINS_KEY] = coinPaise;
  const counted = countedTotal(denominations);
  const expected = view.summary.expectedPaise;
  const diff = counted - expected;
  const keptPaise = Math.min(parseRupees(kept || "0") ?? 0, counted);
  const needsNote = Math.abs(diff) > DIFF_TOLERANCE_PAISE && !note.trim();
  const nothing = counted === 0 && expected !== 0;

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
      <div className="grid gap-x-4 gap-y-1.5 px-4 py-3 sm:grid-cols-2">
        {NOTES.map((n) => {
          const k = String(n);
          const amount = (denominations[k] ?? 0) * n * 100;
          return (
            <label key={n} className="flex items-center gap-2 text-[12px]">
              <span className="w-14 shrink-0 font-semibold tabular-nums">
                ₹{n}
              </span>
              <span className="text-muted-foreground">×</span>
              <input
                inputMode="numeric"
                aria-label={tr("Notes of ₹{{n}}", { n })}
                value={pieces[k] ?? ""}
                placeholder="0"
                onChange={(e) =>
                  setPieces({
                    ...pieces,
                    [k]: e.target.value.replace(/\D/g, "").slice(0, 5),
                  })
                }
                className={cn(fieldClass, "h-8 w-20 text-right tabular-nums")}
              />
              <span className="ml-auto tabular-nums text-muted-foreground">
                {amount ? inrFromPaise(amount) : "—"}
              </span>
            </label>
          );
        })}
        <label className="flex items-center gap-2 text-[12px]">
          <span className="w-14 shrink-0 font-semibold">{tr("Coins")}</span>
          <MoneyInput
            label={tr("Coins total")}
            value={coins}
            onChange={setCoins}
            className="w-[104px]"
          />
          <span className="ml-auto tabular-nums text-muted-foreground">
            {coinPaise ? inrFromPaise(coinPaise) : "—"}
          </span>
        </label>
      </div>

      <div className="grid gap-3 border-t border-border bg-muted/30 px-4 py-3 sm:grid-cols-3">
        <div>
          <p className="text-[10.5px] text-muted-foreground">{tr("Counted")}</p>
          <p className="text-[18px] font-bold tabular-nums">
            {inrFromPaise(counted)}
          </p>
          <p className="text-[10.5px] text-muted-foreground">
            {tr("Should be {{amt}}", { amt: inrFromPaise(expected) })}
          </p>
        </div>
        <div>
          <label
            className="text-[10.5px] text-muted-foreground"
            htmlFor="galla-kept"
          >
            {tr("Leave in galla for tomorrow")}
          </label>
          <MoneyInput
            id="galla-kept"
            label={tr("Leave in galla for tomorrow")}
            value={kept}
            onChange={setKept}
          />
          <p className="mt-0.5 text-[10.5px] text-muted-foreground">
            {tr("Taken out (owner / bank): {{amt}}", {
              amt: inrFromPaise(counted - keptPaise),
            })}
          </p>
        </div>
        <div>
          <label
            className="text-[10.5px] text-muted-foreground"
            htmlFor="galla-note"
          >
            {tr(
              Math.abs(diff) > DIFF_TOLERANCE_PAISE
                ? "Why short / excess? (needed)"
                : "Note (optional)",
            )}
          </label>
          <input
            id="galla-note"
            value={note}
            maxLength={200}
            placeholder={tr("e.g. ₹50 change given extra")}
            onChange={(e) => setNote(e.target.value)}
            className={cn(
              fieldClass,
              needsNote && counted > 0 && "border-amber-400",
            )}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
        {needsNote && counted > 0 ? (
          <p className="mr-auto text-[11px] text-amber-700 dark:text-amber-400">
            {tr("Write why the cash is short / excess, then close.")}
          </p>
        ) : null}
        <Button
          type="button"
          data-primary
          disabled={busy || needsNote || nothing}
          onClick={() => setAsk(true)}
          className="h-9 gap-1.5 rounded-lg text-[12px]"
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
