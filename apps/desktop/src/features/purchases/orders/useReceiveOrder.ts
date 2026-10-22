import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { isOrderOpen, orderToDraft } from "@medicare/domain/purchases/orders";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { tr } from "@/lib/i18n";
import { useOrderStore } from "./useOrderStore";

/**
 * Purchases opened with ?receive=<order id>: load the order, then open
 * the purchase form filled from it (what is still to come).
 */
export function useReceiveOrder(orderId: string | undefined, open: () => void) {
  const [id, setId] = useState(orderId ?? "");
  const orders = useOrderStore((s) => s.orders);
  const loaded = useOrderStore((s) => s.loaded);
  const load = useOrderStore((s) => s.load);
  const medicines = useMedicineStore((s) => s.medicines);
  const order = id ? (orders.find((o) => o.id === id) ?? null) : null;
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (id && !loaded) load().catch((e: Error) => toast.error(e.message));
  }, [id, loaded, load]);

  useEffect(() => {
    if (!id || !loaded || opened) return;
    if (!order || !isOrderOpen(order)) {
      toast.error(tr("This order is not open any more"));
      setId("");
      return;
    }
    setOpened(true);
    open();
  }, [id, loaded, opened, order, open]);

  // Built once, when the form opens (later changes to the order don't reset it)
  const draft = useMemo(
    () =>
      order && opened
        ? orderToDraft(order, new Map(medicines.map((m) => [m.id, m])))
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opened, order?.id],
  );

  return useMemo(
    () => ({
      order: opened ? order : null,
      draft,
      clear: () => {
        setId("");
        setOpened(false);
      },
    }),
    [opened, order, draft],
  );
}
