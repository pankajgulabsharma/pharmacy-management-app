import {
  Fragment,
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  EyeOff,
  ListChecks,
  Printer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { inrFromPaise } from "@medicare/domain/lib/money";
import {
  rackLabel,
  summarizeCount,
} from "@medicare/domain/inventory/stockCount";
import { countSheetHtml } from "@medicare/domain/inventory/countSheet";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { SearchInput } from "@/components/common/SearchInput";
import {
  FilterChips,
  type FilterChipOption,
} from "@/components/common/FilterChips";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/auth/store/useAuthStore";
import { useInventoryRows } from "@/features/inventory/hooks/useInventoryRows";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { usePrintPrefs } from "@/features/printing/usePrintPrefs";
import { printHtml } from "@/lib/print";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CountLineRow } from "./CountLineRow";
import { buildRows, racksText, sheetRows, type CountRow } from "./rows";
import { useStockCountStore, type CountEntry } from "./useStockCountStore";

type Filter = "todo" | "diff" | "counted" | "all";

/** The count screen: rack by rack, type what is on the shelf */
export function CountView() {
  const current = useStockCountStore((s) => s.current)!;
  const pending = useStockCountStore((s) => s.pending);
  const save = useStockCountStore((s) => s.save);
  const post = useStockCountStore((s) => s.post);
  const cancel = useStockCountStore((s) => s.cancel);
  const close = useStockCountStore((s) => s.close);
  const canEdit = useCan("stock");
  const shop = useSettingsStore((s) => s.shop);
  const printer = usePrintPrefs((p) => p.printer);
  const inventory = useInventoryRows();
  const { count, lines } = current;
  const editable = canEdit && count.status === "open";

  const [blind, setBlind] = useState(false);
  const [filter, setFilter] = useState<Filter>(editable ? "todo" : "diff");
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const [confirm, setConfirm] = useState<"post" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(
    () => new Map(inventory.map((b) => [b.id, b])),
    [inventory],
  );
  const rows = useMemo(() => buildRows(lines, byId), [lines, byId]);
  const summary = useMemo(() => {
    if (count.summary) return count.summary;
    const packs = new Map(rows.map((r) => [r.line.medicineId, r.pack]));
    return summarizeCount(
      lines,
      (mid) => packs.get(mid),
      (bid) => byId.get(bid)?.purchasePrice ?? 0,
    );
  }, [count.summary, lines, rows, byId]);

  const shown = useMemo(
    () =>
      rows.filter((r) => {
        if (filter === "todo" && r.counted) return false;
        if (filter === "diff" && !r.diffUnits) return false;
        if (filter === "counted" && !r.counted) return false;
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          (r.batch?.batchNo.toLowerCase().includes(q) ?? false) ||
          rackLabel(r.rack).toLowerCase().includes(q)
        );
      }),
    [rows, filter, q],
  );
  const groups = useMemo(() => {
    const m = new Map<string, CountRow[]>();
    for (const r of shown) m.set(r.rack, [...(m.get(r.rack) ?? []), r]);
    return [...m];
  }, [shown]);

  const onSave = useCallback(
    (e: CountEntry) =>
      void save([e]).catch((err: Error) => toast.error(err.message)),
    [save],
  );

  const diffs = summary.short + summary.excess;
  const options: FilterChipOption<Filter>[] = [
    ...(editable
      ? [
          {
            id: "todo" as const,
            label: "To count",
            count: summary.lines - summary.counted,
          },
        ]
      : []),
    { id: "diff", label: "Differences", count: diffs },
    { id: "counted", label: "Counted", count: summary.counted },
    { id: "all", label: "All", count: summary.lines },
  ];
  const pct = summary.lines
    ? Math.round((summary.counted / summary.lines) * 100)
    : 0;

  const print = (mode: "sheet" | "variance") =>
    printHtml({
      html: countSheetHtml({
        shop,
        count,
        rows: sheetRows(rows),
        mode,
        blind,
        summary,
      }),
      printer,
    }).catch((e: Error) => toast.error(e.message));

  const act = async () => {
    const what = confirm;
    setBusy(true);
    try {
      if (what === "post") {
        const c = await post();
        toast.success(tr("{{no}} posted — stock corrected", { no: c.countNo }));
        setFilter("diff");
      } else {
        await cancel();
        toast.success(tr("Count cancelled — stock not changed"));
      }
      setConfirm(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Could not save"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="box-border flex h-full w-full min-h-0 flex-col gap-2.5 overflow-hidden bg-background p-3">
      <PageHeader
        icon={ClipboardCheck}
        title={`${tr("Stock count")} ${count.countNo}`}
        subtitle={`${tr(racksText(count.racks))} · ${tr("started by {{who}}", { who: count.createdBy })}${count.note ? ` · ${count.note}` : ""}`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={close}
              className="h-8 gap-1 text-[11px]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {tr("All counts")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                print(count.status === "posted" ? "variance" : "sheet")
              }
              className="h-8 gap-1 text-[11px]"
            >
              <Printer className="h-3.5 w-3.5" />
              {count.status === "posted"
                ? tr("Print differences")
                : tr("Print count sheet")}
            </Button>
            {editable ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirm("cancel")}
                  className="h-8 text-[11px] text-rose-600 hover:text-rose-700"
                >
                  {tr("Cancel count")}
                </Button>
                <Button
                  size="sm"
                  disabled={!summary.counted || pending > 0}
                  onClick={() => setConfirm("post")}
                  className="h-8 gap-1 text-[11px]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {tr("Post count")}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          icon={ListChecks}
          label="Counted"
          value={`${summary.counted} / ${summary.lines}`}
          hint={tr("{{pct}}% done", { pct })}
          iconClass="bg-primary/10 text-primary"
        />
        <StatCard
          icon={CheckCircle2}
          label="Matched"
          value={String(summary.matched)}
          hint={tr("same as the app")}
          iconClass="bg-emerald-500/10 text-emerald-600"
        />
        <StatCard
          icon={TrendingDown}
          label="Short (at cost)"
          value={inrFromPaise(summary.shortValuePaise)}
          hint={tr("{{n}} batches", { n: summary.short })}
          iconClass="bg-rose-500/10 text-rose-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Excess (at cost)"
          value={inrFromPaise(summary.excessValuePaise)}
          hint={tr("{{n}} batches", { n: summary.excess })}
          iconClass="bg-sky-500/10 text-sky-600"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search medicine, batch, rack..."
        />
        <FilterChips
          options={options}
          value={filter}
          onChange={setFilter}
          ariaLabel="Show"
        />
        {editable ? (
          <button
            type="button"
            aria-pressed={blind}
            onClick={() => setBlind((b) => !b)}
            title={tr("Hide what the app says, so the count is honest")}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px]",
              blind
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            <EyeOff className="h-3.5 w-3.5" />
            {tr("Blind count")}
          </button>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          {pending > 0
            ? tr("Saving…")
            : editable
              ? tr("Type what is on the shelf · Enter = next · saved by itself")
              : tr(
                  count.status === "posted"
                    ? "Posted {{when}} by {{who}}"
                    : "Cancelled",
                  {
                    when: count.postedAt
                      ? new Date(count.postedAt).toLocaleString("en-IN")
                      : "",
                    who: count.postedBy,
                  },
                )}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card text-foreground">
        {shown.length === 0 ? (
          <EmptyState
            icon={filter === "todo" ? CheckCircle2 : ClipboardCheck}
            title={
              filter === "todo"
                ? "Everything is counted"
                : filter === "diff"
                  ? "No differences"
                  : "Nothing here"
            }
            description={
              filter === "todo"
                ? "Check the differences, then post the count."
                : undefined
            }
            compact
          />
        ) : (
          <table className="w-full table-fixed">
            <colgroup>
              <col />
              {blind ? null : <col className="w-28" />}
              <col className="w-44" />
              <col className="w-32" />
              <col className="w-16" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur">
              <tr className="border-b border-border">
                <th className="py-2 pl-3 text-left font-medium">
                  {tr("Medicine / batch")}
                </th>
                {blind ? null : (
                  <th className="px-2 text-right font-medium">
                    {tr("In app")}
                  </th>
                )}
                <th className="px-2 text-right font-medium">
                  {tr("On shelf")}
                </th>
                <th className="px-2 text-right font-medium">
                  {tr("Difference")}
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {groups.map(([rack, list]) => (
                <Fragment key={rack || "-"}>
                  <tr className="border-b border-border bg-muted/30">
                    <td
                      colSpan={blind ? 4 : 5}
                      className="px-3 py-1 text-[10.5px] font-semibold"
                    >
                      {tr("Rack")} {tr(rackLabel(rack))}
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        {list.filter((r) => r.counted).length}/{list.length}
                      </span>
                    </td>
                  </tr>
                  {list.map((r) => (
                    <CountLineRow
                      key={`${r.line.batchId}:${r.line.countedAt ?? ""}`}
                      row={r}
                      blind={blind}
                      editable={editable}
                      onSave={onSave}
                    />
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={confirm === "post"}
        tone="default"
        icon={CheckCircle2}
        title={tr("Post {{no}}?", { no: count.countNo })}
        description={
          <>
            {tr(
              "{{n}} batches change: short {{short}}, excess {{excess}} (at cost).",
              {
                n: diffs,
                short: inrFromPaise(summary.shortValuePaise),
                excess: inrFromPaise(summary.excessValuePaise),
              },
            )}{" "}
            {summary.counted < summary.lines
              ? tr("{{n}} batches not counted stay as they are.", {
                  n: summary.lines - summary.counted,
                })
              : null}
          </>
        }
        confirmLabel={tr("Post count")}
        cancelLabel={tr("Not yet")}
        confirmDisabled={busy}
        onConfirm={() => void act()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        title={tr("Cancel {{no}}?", { no: count.countNo })}
        description={tr(
          "What was typed is kept in the history, but stock is not changed.",
        )}
        confirmLabel={tr("Cancel count")}
        confirmDisabled={busy}
        onConfirm={() => void act()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
