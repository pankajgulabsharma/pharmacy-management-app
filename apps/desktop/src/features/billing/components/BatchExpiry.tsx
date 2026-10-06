import { CodeChip } from "@/components/common/CodeChip";

type Props = {
  batchNo: string;
  expiry: string;
  /** Shown after the expiry when a line is split across batches, e.g. "2 STP" */
  qty?: string;
  /** Opens the batch's history (where it came from, what happened to it) */
  onClick?: () => void;
};

/** Batch number with its expiry underneath — used on every billing table */
export function BatchExpiry({ batchNo, expiry, qty, onClick }: Props) {
  return (
    <div className="leading-tight">
      {onClick ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          title="Where did this batch come from? (history)"
          className="rounded-md hover:ring-1 hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <CodeChip className="cursor-pointer">{batchNo}</CodeChip>
        </button>
      ) : (
        <CodeChip>{batchNo}</CodeChip>
      )}
      <p className="mt-0.5 text-[10px] text-muted-foreground whitespace-nowrap">
        Exp {expiry}
        {qty ? <span className="text-foreground/70"> · {qty}</span> : null}
      </p>
    </div>
  );
}
