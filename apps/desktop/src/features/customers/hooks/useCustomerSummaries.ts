import { useMemo } from "react";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { useCustomerStore } from "../store/useCustomerStore";
import { customerSummaries } from "../utils/ledger";

/** Live balance etc. for every customer (one pass over the data) */
export function useCustomerSummaries() {
  const customers = useCustomerStore((s) => s.customers);
  const payments = useCustomerStore((s) => s.payments);
  const sales = useSalesStore((s) => s.sales);
  const saleReturns = useSalesStore((s) => s.saleReturns);
  return useMemo(
    () => customerSummaries(customers, sales, saleReturns, payments),
    [customers, sales, saleReturns, payments],
  );
}
