import { useRef, type ReactNode } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  HandCoins,
  QrCode as QrIcon,
  Split,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentDraft,
  type PaymentMethod,
} from "@medicare/domain/billing/types";
import {
  inrFromPaise,
  isMoneyInput,
  paiseToInput,
  parseRupees,
} from "@medicare/domain/lib/money";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/common/Kbd";
import { KEYS } from "@/app/shortcuts/registry";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { focusAtEnd } from "@/lib/dom";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { QrCode } from "./QrCode";
import { upiLink } from "./upi";
import { PAY_INPUT, quickCash } from "./payMath";

const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
const ICON: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  upi: QrIcon,
  card: CreditCard,
  wallet: Wallet,
  udhaar: HandCoins,
  split: Split,
};

type Props = {
  payment: PaymentDraft;
  onChange: (p: PaymentDraft) => void;
  /** Bill total */
  net: number;
  billNo: string;
  /** Udhaar: the customer account picker */
  udhaarSlot?: ReactNode;
  /** Alt+A: the amount / reference box of the chosen method */
  amountRef?: (el: HTMLInputElement | null) => void;
};

/**
 * How the customer pays — like a real counter:
 *  cash   quick notes, change to return, "short by" warning
 *  UPI    QR with the exact amount for any UPI app (+ UTR)
 *  card   charge on the machine (+ approval code)
 *  split  cash + UPI + card, "rest" buttons, live balance
 */
export function PaymentPanel({
  payment,
  onChange,
  net,
  billNo,
  udhaarSlot,
  amountRef,
}: Props) {
  const set = (patch: Partial<PaymentDraft>) =>
    onChange({ ...payment, ...patch });
  const m = payment.method;
  return (
    <>
      <div
        className="grid grid-cols-3 gap-1 shrink-0 mb-1.5"
        role="radiogroup"
        aria-label={tr("Payment method")}
      >
        {METHODS.map((k) => {
          const Icon = ICON[k];
          const on = m === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => set({ method: k })}
              className={cn(
                "inline-flex items-center justify-center gap-1 rounded-md border px-1 py-1.5 text-[10px] font-medium transition-all",
                on
                  ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Icon className="h-3 w-3" />
              {tr(PAYMENT_METHOD_LABELS[k])}
            </button>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto mb-1.5 p-0.5">
        {m === "cash" ? (
          <CashPay
            received={payment.received}
            net={net}
            onReceived={(v) => set({ received: v })}
            amountRef={amountRef}
          />
        ) : m === "upi" ? (
          <UpiPay
            net={net}
            billNo={billNo}
            reference={payment.reference}
            onReference={(v) => set({ reference: v })}
            amountRef={amountRef}
          />
        ) : m === "card" || m === "wallet" ? (
          <MachinePay
            method={m}
            net={net}
            reference={payment.reference}
            onReference={(v) => set({ reference: v })}
            amountRef={amountRef}
          />
        ) : m === "udhaar" ? (
          udhaarSlot
        ) : (
          <SplitPay
            split={payment.split}
            net={net}
            onSplit={(split) => set({ split })}
            amountRef={amountRef}
          />
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function CashPay({
  received,
  net,
  onReceived,
  amountRef,
}: {
  received: string;
  net: number;
  onReceived: (v: string) => void;
  amountRef?: (el: HTMLInputElement | null) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const got = parseRupees(received) ?? 0;
  const empty = received.trim() === "";
  const change = got - net;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor="bill-received"
        className="flex items-center justify-between text-[10px] text-muted-foreground"
      >
        <span>
          {tr("Cash received (₹)")}{" "}
          <Kbd keys={KEYS.payAmount} className="ml-1 align-middle" />
        </span>
      </label>
      <Input
        id="bill-received"
        ref={(el) => {
          ref.current = el;
          amountRef?.(el);
        }}
        value={received}
        onChange={(e) => {
          if (isMoneyInput(e.target.value)) onReceived(e.target.value);
        }}
        placeholder={tr("Exact {{amount}} — leave empty", {
          amount: inrFromPaise(net),
        })}
        className={PAY_INPUT}
        inputMode="decimal"
      />
      <div className="flex flex-wrap gap-1">
        {quickCash(net).map((p, i) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              onReceived(paiseToInput(p));
              focusAtEnd(ref.current);
            }}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums transition-colors",
              got === p && !empty
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/50 hover:bg-muted",
            )}
          >
            {i === 0 ? tr("Exact") : inrFromPaise(p)}
          </button>
        ))}
      </div>
      <div
        className={cn(
          "flex items-center justify-between rounded-lg px-2.5 py-1.5",
          !empty && change < 0
            ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400"
            : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
        )}
        role="status"
      >
        <span className="text-[10px] font-medium">
          {tr(!empty && change < 0 ? "Short by" : "Change to return")}
        </span>
        <span className="text-[15px] font-bold tabular-nums">
          {inrFromPaise(empty ? 0 : Math.abs(change))}
        </span>
      </div>
    </div>
  );
}

function UpiPay({
  net,
  billNo,
  reference,
  onReference,
  amountRef,
}: {
  net: number;
  billNo: string;
  reference: string;
  onReference: (v: string) => void;
  amountRef?: (el: HTMLInputElement | null) => void;
}) {
  const vpa = useSettingsStore((s) => s.billing.upiId);
  const shop = useSettingsStore((s) => s.shop.name);
  return (
    <div className="space-y-1.5">
      {vpa && net > 0 ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-2">
          <QrCode
            value={upiLink(vpa, shop, net, billNo)}
            size={92}
            label={tr("UPI QR for {{amount}}", { amount: inrFromPaise(net) })}
          />
          <div className="min-w-0 space-y-0.5">
            <p className="text-[10px] text-muted-foreground">
              {tr("Scan with any UPI app")}
            </p>
            <p className="text-[18px] font-bold leading-tight tabular-nums">
              {inrFromPaise(net)}
            </p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              {vpa}
            </p>
            <p className="text-[9px] text-muted-foreground">
              {tr("Amount is filled in — check “paid” on their phone")}
            </p>
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-muted/50 px-2.5 py-2 text-[10px] text-muted-foreground">
          {vpa
            ? tr("Add items to show the QR")
            : tr(
                "Collect {{amount}} on UPI. Add the shop's UPI ID in Settings → Billing to show a QR with the amount.",
                { amount: inrFromPaise(net) },
              )}
        </p>
      )}
      <Input
        ref={amountRef}
        value={reference}
        maxLength={40}
        onChange={(e) => onReference(e.target.value)}
        placeholder={tr("UTR / ref no. (optional)")}
        className={PAY_INPUT}
      />
    </div>
  );
}

function MachinePay({
  method,
  net,
  reference,
  onReference,
  amountRef,
}: {
  method: "card" | "wallet";
  net: number;
  reference: string;
  onReference: (v: string) => void;
  amountRef?: (el: HTMLInputElement | null) => void;
}) {
  const Icon = ICON[method];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <p className="text-[10px] text-muted-foreground">
            {tr(
              method === "card"
                ? "Charge on the card machine"
                : "Collect from the wallet app",
            )}
          </p>
          <p className="text-[18px] font-bold leading-tight tabular-nums">
            {inrFromPaise(net)}
          </p>
        </div>
      </div>
      <Input
        ref={amountRef}
        value={reference}
        maxLength={40}
        onChange={(e) => onReference(e.target.value)}
        placeholder={tr(
          method === "card"
            ? "Approval code / last 4 digits (optional)"
            : "Transaction ID (optional)",
        )}
        className={PAY_INPUT}
      />
    </div>
  );
}

const SPLIT_PARTS = [
  ["cash", Banknote],
  ["upi", QrIcon],
  ["card", CreditCard],
] as const;

function SplitPay({
  split,
  net,
  onSplit,
  amountRef,
}: {
  split: PaymentDraft["split"];
  net: number;
  onSplit: (s: PaymentDraft["split"]) => void;
  amountRef?: (el: HTMLInputElement | null) => void;
}) {
  const value = (k: keyof PaymentDraft["split"]) => parseRupees(split[k]) ?? 0;
  const sum = value("cash") + value("upi") + value("card");
  const left = net - sum;
  const pct = net > 0 ? Math.min(100, Math.round((sum / net) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div>
        <div className="mb-1 flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">
            {tr("{{got}} of {{total}}", {
              got: inrFromPaise(sum),
              total: inrFromPaise(net),
            })}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 font-semibold",
              left === 0
                ? "text-emerald-600"
                : left > 0
                  ? "text-orange-600"
                  : "text-red-600",
            )}
          >
            {left === 0 ? <CheckCircle2 className="h-3 w-3" /> : null}
            {left === 0
              ? tr("Balanced")
              : left > 0
                ? tr("Left {{amount}}", { amount: inrFromPaise(left) })
                : tr("Over by {{amount}}", { amount: inrFromPaise(-left) })}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              left < 0
                ? "bg-red-500"
                : left === 0
                  ? "bg-emerald-500"
                  : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {SPLIT_PARTS.map(([k, Icon]) => {
        const rest = Math.max(0, left + value(k));
        return (
          <div key={k} className="flex items-center gap-1.5">
            <span className="flex w-14 shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
              <Icon className="h-3 w-3" />
              {tr(PAYMENT_METHOD_LABELS[k])}
            </span>
            <Input
              ref={k === "cash" ? amountRef : undefined}
              value={split[k]}
              onChange={(e) => {
                if (isMoneyInput(e.target.value))
                  onSplit({ ...split, [k]: e.target.value });
              }}
              placeholder="0"
              aria-label={tr("Split {{part}} amount", {
                part: tr(PAYMENT_METHOD_LABELS[k]),
              })}
              className={PAY_INPUT}
              inputMode="decimal"
            />
            <button
              type="button"
              disabled={rest === 0 || rest === value(k)}
              onClick={() => onSplit({ ...split, [k]: paiseToInput(rest) })}
              title={tr("Put the rest here")}
              className="h-8 shrink-0 rounded-md border border-border px-1.5 text-[9px] font-medium text-primary hover:bg-muted disabled:opacity-40"
            >
              {tr("Rest")}
            </button>
          </div>
        );
      })}
    </div>
  );
}
