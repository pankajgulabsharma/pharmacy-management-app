import { memo, useMemo, type ReactNode } from "react";
import { PackagePlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/EmptyState";
import { TableShell, type TableColumn } from "@/components/common/TableShell";
import { RowActionButton } from "@/components/common/RowActionButton";
import {
  cellInputClass,
  invalidFieldClass,
} from "@/components/common/formStyles";
import { formatPackLabel } from "@/features/medicines/types";
import { formatExpiryInput, monthsToExpiry } from "@/lib/expiry";
import { formatPaise, isMoneyInput } from "@/lib/money";
import { isIntInput, isPercentInput, toCodeInput } from "@/lib/sanitize";
import {
  GST_RATES,
  PURCHASE_LIMITS,
  type GstRate,
  type PurchaseLineDraft,
  type PurchaseLineField,
} from "../types";
import { calcLine } from "../utils/calc";
import { draftLineToAmountInput } from "../utils/draft";
import type { LineErrors } from "../utils/validation";

export type LineChangeHandler = <K extends PurchaseLineField>(
  key: string,
  field: K,
  value: PurchaseLineDraft[K],
) => void;

type Props = {
  lines: PurchaseLineDraft[];
  errors: Record<string, LineErrors>;
  today: Date;
  onChange: LineChangeHandler;
  onRemove: (key: string) => void;
};

const COLUMNS: TableColumn[] = [
  { key: "index", label: "#", width: "w-[36px]" },
  { key: "medicine", label: "Medicine" },
  { key: "batch", label: "Batch", width: "w-[112px]" },
  { key: "expiry", label: "Expiry", width: "w-[84px]" },
  { key: "qty", label: "Qty", width: "w-[72px]" },
  { key: "free", label: "Free", width: "w-[64px]" },
  { key: "rate", label: "Rate (₹)", width: "w-[112px]" },
  { key: "mrp", label: "MRP (₹)", width: "w-[88px]" },
  { key: "disc", label: "Disc %", width: "w-[68px]" },
  { key: "gst", label: "GST %", width: "w-[72px]" },
  {
    key: "amount",
    label: "Amount (₹)",
    width: "w-[104px]",
    align: "text-right",
  },
  { key: "remove", label: "", width: "w-[44px]", align: "text-center" },
];

const EMPTY_LINE_ERRORS: LineErrors = {};

export function PurchaseLinesEditor({
  lines,
  errors,
  today,
  onChange,
  onRemove,
}: Props) {
  if (lines.length === 0) {
    return (
      <EmptyState
        icon={PackagePlus}
        title="No medicines added yet"
        description="Search above or scan a barcode to add the first item from the supplier's invoice."
      />
    );
  }

  return (
    <TableShell
      columns={COLUMNS}
      minWidthClass="min-w-[1080px]"
      headerCellClass="px-2"
    >
      {lines.map((line, index) => (
        <LineRow
          key={line.key}
          index={index}
          line={line}
          errors={errors[line.key] ?? EMPTY_LINE_ERRORS}
          today={today}
          onChange={onChange}
          onRemove={onRemove}
        />
      ))}
    </TableShell>
  );
}

/* ------------------------------------------------------------------ */
/* Row — memoized; only the edited row re-renders while typing        */
/* ------------------------------------------------------------------ */

type RowProps = {
  index: number;
  line: PurchaseLineDraft;
  errors: LineErrors;
  today: Date;
  onChange: LineChangeHandler;
  onRemove: (key: string) => void;
};

function sameErrors(a: LineErrors, b: LineErrors): boolean {
  if (a === b) return true;
  const ak = Object.keys(a) as (keyof LineErrors)[];
  if (ak.length !== Object.keys(b).length) return false;
  return ak.every((k) => a[k] === b[k]);
}

const LineRow = memo(
  function LineRow({
    index,
    line,
    errors,
    today,
    onChange,
    onRemove,
  }: RowProps) {
    const amounts = useMemo(
      () => calcLine(draftLineToAmountInput(line)),
      [line],
    );

    const months = monthsToExpiry(line.expiry, today);
    const shortExpiry =
      !errors.expiry &&
      months !== null &&
      months >= 0 &&
      months < PURCHASE_LIMITS.shortExpiryMonths;

    const k = line.key;

    return (
      <tr className="border-b border-border/60 last:border-0 align-top hover:bg-muted/30">
        <td className="px-2 py-2 text-muted-foreground tabular-nums">
          {index + 1}
        </td>

        <td className="px-2 py-2">
          <p
            className="font-medium text-foreground leading-tight truncate"
            title={line.medicineName}
          >
            {line.medicineName}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
            {line.brand} · {formatPackLabel(line.unit, line.unitsPerStrip)}
          </p>
        </td>

        <Cell error={errors.batchNo}>
          <input
            data-line={k}
            data-field="batchNo"
            value={line.batchNo}
            onChange={(e) =>
              onChange(
                k,
                "batchNo",
                toCodeInput(e.target.value, PURCHASE_LIMITS.batchNoMax),
              )
            }
            placeholder="Batch no."
            aria-label={`Batch for ${line.medicineName}`}
            aria-invalid={Boolean(errors.batchNo)}
            className={cn(
              cellInputClass,
              "font-mono",
              errors.batchNo && invalidFieldClass,
            )}
            autoComplete="off"
            spellCheck={false}
          />
        </Cell>

        <Cell
          error={errors.expiry}
          hint={shortExpiry ? "Short expiry" : undefined}
        >
          <input
            value={line.expiry}
            onChange={(e) =>
              onChange(k, "expiry", formatExpiryInput(e.target.value))
            }
            placeholder="MM/YY"
            inputMode="numeric"
            aria-label={`Expiry for ${line.medicineName}`}
            aria-invalid={Boolean(errors.expiry)}
            className={cn(
              cellInputClass,
              "tabular-nums",
              errors.expiry && invalidFieldClass,
              shortExpiry && "!border-amber-500/60",
            )}
          />
        </Cell>

        <Cell error={errors.qty}>
          <input
            value={line.qty}
            onChange={(e) => {
              if (isIntInput(e.target.value))
                onChange(k, "qty", e.target.value);
            }}
            placeholder="0"
            inputMode="numeric"
            aria-label={`Quantity for ${line.medicineName}`}
            aria-invalid={Boolean(errors.qty)}
            className={cn(
              cellInputClass,
              "tabular-nums",
              errors.qty && invalidFieldClass,
            )}
          />
        </Cell>

        <Cell error={errors.freeQty}>
          <input
            value={line.freeQty}
            onChange={(e) => {
              if (isIntInput(e.target.value))
                onChange(k, "freeQty", e.target.value);
            }}
            placeholder="0"
            inputMode="numeric"
            aria-label={`Free quantity for ${line.medicineName}`}
            aria-invalid={Boolean(errors.freeQty)}
            className={cn(
              cellInputClass,
              "tabular-nums",
              errors.freeQty && invalidFieldClass,
            )}
          />
        </Cell>

        <Cell
          error={errors.rate}
          hint={
            amounts.landedPerPackPaise > 0
              ? `Landed ₹${formatPaise(amounts.landedPerPackPaise)}/${line.unit}`
              : undefined
          }
        >
          <input
            value={line.rate}
            onChange={(e) => {
              if (isMoneyInput(e.target.value))
                onChange(k, "rate", e.target.value);
            }}
            placeholder="0.00"
            inputMode="decimal"
            aria-label={`Rate for ${line.medicineName}`}
            aria-invalid={Boolean(errors.rate)}
            className={cn(
              cellInputClass,
              "tabular-nums",
              errors.rate && invalidFieldClass,
            )}
          />
        </Cell>

        <Cell error={errors.mrp}>
          <input
            value={line.mrp}
            onChange={(e) => {
              if (isMoneyInput(e.target.value))
                onChange(k, "mrp", e.target.value);
            }}
            placeholder="0.00"
            inputMode="decimal"
            aria-label={`MRP for ${line.medicineName}`}
            aria-invalid={Boolean(errors.mrp)}
            className={cn(
              cellInputClass,
              "tabular-nums",
              errors.mrp && invalidFieldClass,
            )}
          />
        </Cell>

        <Cell error={errors.discountPercent}>
          <input
            value={line.discountPercent}
            onChange={(e) => {
              if (isPercentInput(e.target.value)) {
                onChange(k, "discountPercent", e.target.value);
              }
            }}
            placeholder="0"
            inputMode="decimal"
            aria-label={`Discount for ${line.medicineName}`}
            aria-invalid={Boolean(errors.discountPercent)}
            className={cn(
              cellInputClass,
              "tabular-nums",
              errors.discountPercent && invalidFieldClass,
            )}
          />
        </Cell>

        <Cell error={errors.gstPercent}>
          <select
            value={line.gstPercent}
            onChange={(e) =>
              onChange(k, "gstPercent", Number(e.target.value) as GstRate)
            }
            aria-label={`GST for ${line.medicineName}`}
            className={cn(
              cellInputClass,
              "px-1.5",
              errors.gstPercent && invalidFieldClass,
            )}
          >
            {GST_RATES.map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </select>
        </Cell>

        <td className="px-2 py-2 text-right">
          <p className="font-semibold tabular-nums text-foreground leading-7">
            {formatPaise(amounts.totalPaise)}
          </p>
          {amounts.gstPaise > 0 ? (
            <p className="text-[10px] text-muted-foreground tabular-nums">
              incl. GST ₹{formatPaise(amounts.gstPaise)}
            </p>
          ) : null}
        </td>

        <td className="px-1 py-2 text-center">
          <RowActionButton
            icon={Trash2}
            tone="danger"
            label={`Remove ${line.medicineName}`}
            title="Remove item"
            onClick={() => onRemove(k)}
          />
        </td>
      </tr>
    );
  },
  (prev, next) =>
    prev.line === next.line &&
    prev.index === next.index &&
    prev.today === next.today &&
    prev.onChange === next.onChange &&
    prev.onRemove === next.onRemove &&
    sameErrors(prev.errors, next.errors),
);

function Cell({
  error,
  hint,
  children,
}: {
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <td className="px-2 py-2">
      {children}
      {error ? (
        <p
          className="mt-0.5 text-[9px] leading-tight text-red-500 truncate"
          title={error}
        >
          {error}
        </p>
      ) : hint ? (
        <p
          className="mt-0.5 text-[9px] leading-tight text-muted-foreground truncate"
          title={hint}
        >
          {hint}
        </p>
      ) : null}
    </td>
  );
}
