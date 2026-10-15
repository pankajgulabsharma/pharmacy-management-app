import { useId, useMemo } from "react";
import { Check, MessageCircle, Repeat } from "lucide-react";
import { toast } from "sonner";
import {
  refillMessage,
  type RefillDue,
} from "@medicare/domain/customers/refills";
import {
  whatsappLink,
  whatsappNumber,
} from "@medicare/domain/printing/whatsapp";
import { ModalShell } from "@/components/common/ModalShell";
import { DialogCloseButton } from "@/components/common/DialogCloseButton";
import { EmptyState } from "@/components/common/EmptyState";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { useRefills } from "./useRefills";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

function when(r: RefillDue) {
  if (r.daysLeft < 0)
    return { text: tr("{{n}} days late", { n: -r.daysLeft }), late: true };
  if (r.daysLeft === 0) return { text: tr("due today"), late: true };
  return { text: tr("in {{n}} days", { n: r.daysLeft }), late: false };
}

/**
 * Regular customers whose medicine is about to run out. One WhatsApp per
 * customer with all their medicines; "Done" hides it until they buy again.
 */
export function RefillsDialog({ onClose }: { onClose: () => void }) {
  const id = useId();
  const { due, markDone } = useRefills();
  const shopName = useSettingsStore((s) => s.shop.name);
  const groups = useMemo(() => {
    const by = new Map<string, RefillDue[]>();
    for (const r of due)
      by.set(r.customerId, [...(by.get(r.customerId) ?? []), r]);
    return [...by.values()];
  }, [due]);

  const send = (items: RefillDue[]) => {
    const n = whatsappNumber(items[0].phone);
    if (!n) return;
    window.open(
      whatsappLink(
        n,
        refillMessage(
          items[0].customerName,
          items.map((r) => r.medicineName),
          shopName,
        ),
      ),
      "_blank",
    );
    markDone(items);
    toast.success(tr("Reminder sent — marked done"));
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={`${id}-t`}
      className="max-w-2xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <h2 id={`${id}-t`} className="text-sm font-semibold">
            {tr("Refills due")}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {tr(
              "Customers who buy the same medicine regularly — remind them before it runs out (free WhatsApp, no SMS)",
            )}
          </p>
        </div>
        <DialogCloseButton onClick={onClose} />
      </div>
      <div className="max-h-[65vh] overflow-y-auto p-3 space-y-2">
        {groups.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="No refills due"
            description="Customers who bought the same medicine on 2 or more bills show here a few days before it runs out."
          />
        ) : (
          groups.map((items) => {
            const c = items[0];
            const canSend = !!whatsappNumber(c.phone);
            return (
              <div
                key={c.customerId}
                className="rounded-lg border border-border"
              >
                <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold truncate">
                      {c.customerName}
                    </p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {c.phone || tr("No mobile saved")}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canSend}
                    onClick={() => send(items)}
                    title={
                      canSend
                        ? undefined
                        : tr("Add a mobile number to the customer first")
                    }
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-[11px] font-semibold text-white hover:bg-[#1fb857] disabled:opacity-40"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {tr("WhatsApp")}
                  </button>
                  <button
                    type="button"
                    onClick={() => markDone(items)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[11px] font-medium hover:bg-muted"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {tr("Done")}
                  </button>
                </div>
                <ul className="divide-y divide-border/50">
                  {items.map((r) => {
                    const w = when(r);
                    return (
                      <li
                        key={r.key}
                        className="flex items-center gap-3 px-3 py-1.5 text-[11px]"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {r.medicineName}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {tr("every ~{{n}} days · last {{date}}", {
                            n: r.everyDays,
                            date: day(r.lastAt),
                          })}
                        </span>
                        <span
                          className={cn(
                            "w-24 shrink-0 text-right font-semibold",
                            w.late
                              ? "text-orange-600"
                              : "text-emerald-700 dark:text-emerald-400",
                          )}
                        >
                          {w.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </ModalShell>
  );
}
