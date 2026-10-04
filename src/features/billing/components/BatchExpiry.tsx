import { CodeChip } from "@/components/common/CodeChip";

type Props = {
  batchNo: string;
  expiry: string;
  /** Shown after the expiry when a line is split across batches, e.g. "2 STP" */
  qty?: string;
};

/** Batch number with its expiry underneath — used on every billing table */
export function BatchExpiry({ batchNo, expiry, qty }: Props) {
  return (
    <div className="leading-tight">
      <CodeChip>{batchNo}</CodeChip>
      <p className="mt-0.5 text-[10px] text-muted-foreground whitespace-nowrap">
        Exp {expiry}
        {qty ? <span className="text-foreground/70"> · {qty}</span> : null}
      </p>
    </div>
  );
}
