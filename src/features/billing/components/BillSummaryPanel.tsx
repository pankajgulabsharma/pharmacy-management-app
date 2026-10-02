import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatRupees, isMoneyInput } from "@/lib/money";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import type { BillLineItem, PaymentMethod } from "../types";
import {
  calcLineAmount,
  calcLineDiscount,
  calcLineGross,
  roundOffToRupee,
} from "../types";

type Props = {
  billNo: string;
  items: BillLineItem[];
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (m: PaymentMethod) => void;
  receivedAmount: string;
  onReceivedAmountChange: (v: string) => void;
  customerName?: string;
};

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
  { id: "wallet", label: "Wallet" },
  { id: "udhaar", label: "Udhaar" },
  { id: "split", label: "Split" },
];

const PAY_INPUT = cn(
  "h-7 w-full rounded-md !text-[10px] leading-none",
  "bg-muted/40 border border-border/50 shadow-none",
  "placeholder:!text-[10px] placeholder:text-muted-foreground",
  "hover:border-border hover:bg-muted/50",
  "focus-visible:outline-none focus-visible:ring-1",
  "focus-visible:ring-ring focus-visible:border-border",
  "focus-visible:bg-background",
);

const PREV_UDHAAR_DUE = 1240; // TODO: customer ledger API

/** Absolute value — signs are rendered separately in the summary rows */
function formatINR(n: number) {
  return formatRupees(Math.abs(n));
}

export function BillSummaryPanel({
  billNo,
  items,
  paymentMethod,
  onPaymentMethodChange,
  receivedAmount,
  onReceivedAmountChange,
  customerName = "Customer",
}: Props) {
  const { t } = useTranslation();
  const [splitCash, setSplitCash] = useState("");
  const [splitUpi, setSplitUpi] = useState("");
  const [splitCard, setSplitCard] = useState("");

  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let afterDiscount = 0;
    for (const item of items) {
      subtotal += calcLineGross(item);
      discount += calcLineDiscount(item);
      afterDiscount += calcLineAmount(item);
    }
    const gst = afterDiscount * 0.12;
    const { rounded, roundOff } = roundOffToRupee(afterDiscount + gst);
    return { subtotal, discount, gst, roundOff, total: rounded };
  }, [items]);

  const received = Number.parseFloat(receivedAmount);
  const changeDue =
    paymentMethod === "cash" && received > 0
      ? Math.max(0, received - totals.total)
      : 0;

  const splitSum =
    (Number.parseFloat(splitCash) || 0) +
    (Number.parseFloat(splitUpi) || 0) +
    (Number.parseFloat(splitCard) || 0);
  const splitRemaining = Math.max(0, totals.total - splitSum);

  const canSave =
    items.length > 0 &&
    (paymentMethod !== "cash" && paymentMethod !== "split"
      ? true
      : paymentMethod === "cash"
        ? !Number.isNaN(received) && received >= totals.total
        : splitSum >= totals.total - 0.01);

  const displayName = customerName.trim() || "Customer";
  const dueAfterBill = PREV_UDHAAR_DUE + totals.total;

  const onAmountChange = useCallback(
    (value: string) => {
      if (isMoneyInput(value)) onReceivedAmountChange(value);
    },
    [onReceivedAmountChange],
  );

  return (
    <div className="h-full flex flex-col gap-2 overflow-hidden">
      {/* Summary ~52% */}
      <div className="bg-card border border-border rounded-lg p-2.5 flex-[52] min-h-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border/60 shrink-0">
          <h3 className="text-[11px] font-semibold text-foreground">
            {t("billing.billSummary")}
          </h3>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground">{billNo}</span>
            <StatusBadge tone="caution" size="xs">
              {t("billing.draft")}
            </StatusBadge>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("billing.noItems")}
            description={t("billing.noItemsHint")}
            compact
            bordered={false}
          />
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-1 mb-1.5 min-h-0">
              {items.map((item) => (
                <div
                  key={item.lineId}
                  className="flex items-start justify-between gap-2 text-[10px]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {item.medicine.name}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {item.qtyStrip} STP
                      {item.qtyLoose > 0 ? ` + ${item.qtyLoose} LSE` : ""}
                      {item.discountPercent > 0
                        ? ` · ${item.discountPercent}% off`
                        : ""}
                    </p>
                  </div>
                  <span className="tabular-nums font-medium shrink-0">
                    ₹{calcLineAmount(item).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-1.5 space-y-0.5 text-[10px] shrink-0">
              <Row label="Subtotal" value={`₹${formatINR(totals.subtotal)}`} />
              <Row
                label="Discount"
                value={`−₹${formatINR(totals.discount)}`}
                valueClass="text-emerald-600 dark:text-emerald-400"
              />
              <Row label="GST (12%)" value={`₹${formatINR(totals.gst)}`} />
              <Row
                label="Round Off"
                value={`${totals.roundOff >= 0 ? "+" : "−"}₹${formatINR(totals.roundOff)}`}
              />
              <div className="flex justify-between text-[12px] font-bold text-primary pt-0.5">
                <span>Total</span>
                <span className="tabular-nums">₹{formatINR(totals.total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment ~48% */}
      <div className="bg-card border border-border rounded-lg p-2.5 flex-[48] min-h-0 flex flex-col overflow-hidden">
        <h3 className="text-[11px] font-semibold text-foreground shrink-0 mb-1.5">
          {t("billing.paymentMethod")}
        </h3>

        <div className="grid grid-cols-3 gap-1 shrink-0 mb-1.5">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPaymentMethodChange(m.id)}
              className={cn(
                "rounded-md border px-1 py-1.5 text-[9px] font-medium transition-colors",
                paymentMethod === m.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto mb-1.5 p-0.5">
          {paymentMethod === "cash" && (
            <div className="space-y-1">
              <label className="text-[9px] text-muted-foreground block">
                Received (₹)
              </label>
              <Input
                value={receivedAmount}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="0.00"
                className={PAY_INPUT}
                inputMode="decimal"
              />
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Change</span>
                <span className="font-semibold tabular-nums">
                  ₹{formatINR(changeDue)}
                </span>
              </div>
            </div>
          )}

          {paymentMethod === "upi" && (
            <div className="space-y-1">
              <p className="text-[9px] text-muted-foreground">
                Pay{" "}
                <span className="font-semibold text-foreground">
                  ₹{formatINR(totals.total)}
                </span>{" "}
                via UPI
              </p>
              <Input
                value={receivedAmount}
                onChange={(e) => onReceivedAmountChange(e.target.value)}
                placeholder="UTR (optional)"
                className={PAY_INPUT}
              />
            </div>
          )}

          {paymentMethod === "card" && (
            <div className="space-y-1">
              <p className="text-[9px] text-muted-foreground">
                Card{" "}
                <span className="font-semibold text-foreground">
                  ₹{formatINR(totals.total)}
                </span>
              </p>
              <Input
                value={receivedAmount}
                onChange={(e) => onReceivedAmountChange(e.target.value)}
                placeholder="Approval code"
                className={PAY_INPUT}
              />
            </div>
          )}

          {paymentMethod === "wallet" && (
            <p className="text-[9px] text-muted-foreground pt-1">
              Wallet debit{" "}
              <span className="font-semibold text-foreground">
                ₹{formatINR(totals.total)}
              </span>
            </p>
          )}

          {paymentMethod === "udhaar" && (
            <div className="space-y-1.5 rounded-md border border-red-500/20 bg-red-50/50 dark:bg-red-950/20 p-2">
              <p className="text-[10px] text-foreground leading-snug">
                <span className="font-semibold text-red-600">
                  ₹{formatINR(totals.total)}
                </span>{" "}
                is added to <span className="font-medium">{displayName}</span>{" "}
                udhaar
              </p>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Due after this bill{" "}
                <span className="font-semibold text-foreground">
                  ₹{formatINR(dueAfterBill)}
                </span>
              </p>
            </div>
          )}

          {paymentMethod === "split" && (
            <div className="space-y-1">
              <p className="text-[9px] text-muted-foreground">
                Left{" "}
                <span
                  className={cn(
                    "font-semibold",
                    splitRemaining > 0.01
                      ? "text-orange-600"
                      : "text-emerald-600",
                  )}
                >
                  ₹{formatINR(splitRemaining)}
                </span>
              </p>
              {(
                [
                  ["Cash", splitCash, setSplitCash],
                  ["UPI", splitUpi, setSplitUpi],
                  ["Card", splitCard, setSplitCard],
                ] as const
              ).map(([label, val, setVal]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="text-[9px] text-muted-foreground w-8 shrink-0">
                    {label}
                  </span>
                  <Input
                    value={val}
                    onChange={(e) => {
                      if (isMoneyInput(e.target.value)) setVal(e.target.value);
                    }}
                    placeholder="0"
                    className={PAY_INPUT}
                    inputMode="decimal"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5 shrink-0">
          <Button
            type="button"
            disabled={!canSave}
            className="w-full h-8 rounded-md text-[11px] bg-primary text-primary-foreground disabled:opacity-50"
          >
            {t("billing.savePrint")}
            {items.length > 0 ? ` · ₹${formatINR(totals.total)}` : ""}
          </Button>
          <div className="grid grid-cols-2 gap-1">
            <Button
              type="button"
              variant="outline"
              className="h-7 rounded-md text-[9px] border-border"
            >
              {t("billing.holdBill")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-7 rounded-md text-[9px] border-border"
            >
              {t("billing.saveNoPrint")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}
