import { Plus, X } from "lucide-react";
import { formatPaise } from "@medicare/domain/lib/money";
import { Kbd } from "@/components/common/Kbd";
import { KEYS } from "@/app/shortcuts/registry";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { MAX_BILL_TABS, type BillDraft } from "../store/useBillTabsStore";

type Props = {
  drafts: readonly BillDraft[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** Close: an empty bill just closes, one with items goes to Held bills */
  onClose: (id: string) => void;
};

/** Bills open at this counter — one tab per customer (max 10) */
export function BillTabs({
  drafts,
  activeId,
  onSelect,
  onNew,
  onClose,
}: Props) {
  return (
    <div
      role="tablist"
      aria-label={tr("Open bills")}
      className="flex items-center gap-1 shrink-0 overflow-x-auto -mb-1 pb-0.5"
    >
      {drafts.map((d, i) => {
        const active = d.id === activeId;
        const name = d.customerName.trim() || `${tr("Bill")} ${i + 1}`;
        return (
          <div
            key={d.id}
            className={cn(
              "group h-8 shrink-0 max-w-[180px] rounded-lg border text-[11px] inline-flex items-center transition-colors",
              active
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60",
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(d.id)}
              title={i < 9 ? `Ctrl+${i + 1}` : undefined}
              className="h-full min-w-0 pl-2.5 pr-1 inline-flex items-center gap-1.5"
            >
              <span className="truncate font-medium">{name}</span>
              {d.cart.length > 0 ? (
                <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                  {d.cart.length} · ₹{formatPaise(d.netPaise)}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              aria-label={`${tr("Close")} ${name}`}
              title={
                d.cart.length > 0
                  ? tr("Close (bill goes to Held bills)")
                  : tr("Close")
              }
              onClick={() => onClose(d.id)}
              className="h-full px-1.5 rounded-r-lg opacity-60 hover:opacity-100 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      {drafts.length < MAX_BILL_TABS ? <NewButton onNew={onNew} /> : null}
    </div>
  );
}

function NewButton({ onNew }: { onNew: () => void }) {
  return (
    <button
      type="button"
      onClick={onNew}
      className="h-8 shrink-0 rounded-lg border border-dashed border-border px-2.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
    >
      <Plus className="h-3.5 w-3.5" />
      {tr("New bill tab")}
      <Kbd keys={KEYS.newBillTab} />
    </button>
  );
}
