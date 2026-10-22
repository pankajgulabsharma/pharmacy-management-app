import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ClipboardList,
  IndianRupee,
  PackageX,
  Plus,
  Send,
} from "lucide-react";
import {
  isOrderOpen,
  orderValuePaise,
  ORDER_STATUS_META,
  pendingQty,
  type PurchaseOrder,
} from "@medicare/domain/purchases/orders";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterChips } from "@/components/common/FilterChips";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/auth/store/useAuthStore";
import { useUrlIntent } from "@/hooks/useUrlIntent";
import { tr, trn } from "@/lib/i18n";
import { OrderDetailsDialog } from "./OrderDetailsDialog";
import { OrderFormDialog } from "./OrderFormDialog";
import { useOrderStore } from "./useOrderStore";

type Filter = "open" | "short" | "all";

const day = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/** Purchases → Orders: what was ordered from whom, what came, what's short */
export default function OrdersPage() {
  const navigate = useNavigate();
  const intent = useUrlIntent();
  const canMake = useCan("purchases");
  const orders = useOrderStore((s) => s.orders);
  const loaded = useOrderStore((s) => s.loaded);
  const load = useOrderStore((s) => s.load);
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<string | null>(intent.view ?? null);
  const [form, setForm] = useState<{ editing: PurchaseOrder | null } | null>(
    intent.new === "1" ? { editing: null } : null,
  );
  const first = useRef(true);

  useEffect(() => {
    if (!first.current) return;
    first.current = false;
    load().catch((e: Error) => toast.error(e.message));
  }, [load]);

  const stats = useMemo(() => {
    const open = orders.filter(isOrderOpen);
    const short = orders.filter(
      (o) => o.status === "partial" || o.status === "closed",
    );
    return {
      open: open.length,
      notSent: orders.filter((o) => o.status === "open").length,
      value: open.reduce((a, o) => a + orderValuePaise(o.lines), 0),
      short: short.length,
    };
  }, [orders]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter === "open" && !isOrderOpen(o)) return false;
      if (filter === "short" && o.status !== "partial" && o.status !== "closed")
        return false;
      if (!q) return true;
      return (
        o.orderNo.toLowerCase().includes(q) ||
        o.supplierName.toLowerCase().includes(q) ||
        o.lines.some((l) => l.medicineName.toLowerCase().includes(q))
      );
    });
  }, [orders, filter, query]);

  const current = orders.find((o) => o.id === viewing) ?? null;

  return (
    <div className="box-border flex h-full w-full min-h-0 flex-col gap-2.5 overflow-hidden bg-background p-3">
      <PageHeader
        icon={ClipboardList}
        title="Purchase orders"
        subtitle="Order from suppliers · receive the bill against it · see what came short"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/purchases")}
              className="h-8 gap-1 text-[11px]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {tr("Purchases")}
            </Button>
            {canMake ? (
              <Button
                size="sm"
                onClick={() => setForm({ editing: null })}
                className="h-8 gap-1 text-[11px]"
              >
                <Plus className="h-3.5 w-3.5" />
                {tr("New order")}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="Open orders"
          value={String(stats.open)}
          iconClass="bg-primary/10 text-primary"
        />
        <StatCard
          icon={Send}
          label="Not sent yet"
          value={String(stats.notSent)}
          iconClass="bg-amber-500/10 text-amber-600"
        />
        <StatCard
          icon={IndianRupee}
          label="On order (approx.)"
          value={inrFromPaise(stats.value)}
          iconClass="bg-emerald-500/10 text-emerald-600"
        />
        <StatCard
          icon={PackageX}
          label="Came short"
          value={String(stats.short)}
          iconClass="bg-rose-500/10 text-rose-600"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search order, supplier, medicine..."
        />
        <FilterChips
          ariaLabel="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "open", label: "Still open", count: stats.open },
            { id: "short", label: "Came short", count: stats.short },
            { id: "all", label: "All", count: orders.length },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card text-foreground">
        {loaded && !shown.length ? (
          <EmptyState
            icon={ClipboardList}
            title={orders.length ? "Nothing here" : "No purchase orders yet"}
            description={
              orders.length
                ? undefined
                : "Make one from New order (or Reports → What to order), send it on WhatsApp, and enter the bill against it when goods come."
            }
          />
        ) : (
          <table className="w-full text-[11.5px]">
            <thead className="sticky top-0 z-10 bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur">
              <tr className="border-b border-border text-left">
                <th className="py-2 pl-3 font-medium">{tr("Order")}</th>
                <th className="font-medium">{tr("Supplier")}</th>
                <th className="font-medium">{tr("Date")}</th>
                <th className="text-right font-medium">{tr("Items")}</th>
                <th className="text-right font-medium">{tr("Received")}</th>
                <th className="text-right font-medium">
                  {tr("Approx. value")}
                </th>
                <th className="pl-4 pr-3 font-medium">{tr("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => {
                const meta = ORDER_STATUS_META[o.status];
                const done = o.lines.filter((l) => pendingQty(l) === 0).length;
                return (
                  <tr
                    key={o.id}
                    tabIndex={0}
                    onClick={() => setViewing(o.id)}
                    onKeyDown={(e) => e.key === "Enter" && setViewing(o.id)}
                    className="cursor-pointer border-b border-border/60 hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <td className="py-2 pl-3 font-mono font-medium">
                      {o.orderNo}
                    </td>
                    <td className="max-w-[240px] truncate">{o.supplierName}</td>
                    <td className="text-muted-foreground">{day(o.date)}</td>
                    <td className="text-right tabular-nums">
                      {o.lines.length}
                    </td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {o.receipts.length ? `${done}/${o.lines.length}` : "—"}
                    </td>
                    <td className="text-right tabular-nums">
                      {inrFromPaise(orderValuePaise(o.lines))}
                    </td>
                    <td className="pl-4 pr-3">
                      <StatusBadge tone={meta.tone}>
                        {tr(meta.label)}
                      </StatusBadge>
                      {o.receipts.length ? (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          {trn(o.receipts.length, "1 bill", "{{n}} bills")}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {current ? (
        <OrderDetailsDialog
          order={current}
          onClose={() => setViewing(null)}
          onEdit={(o) => {
            setViewing(null);
            setForm({ editing: o });
          }}
        />
      ) : null}
      {form ? (
        <OrderFormDialog
          editing={form.editing}
          initialSupplierId={intent.supplier ?? ""}
          onClose={() => setForm(null)}
          onSaved={(o) => {
            setForm(null);
            setViewing(o.id);
          }}
        />
      ) : null}
    </div>
  );
}
