import { toast } from "sonner";
import { debitNoteHtml } from "@medicare/domain/purchases/debitNote";
import type { PurchaseReturn } from "@medicare/domain/purchases/types";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { useSupplierStore } from "@/features/suppliers/store/useSupplierStore";
import { printHtml } from "@/lib/print";

/** Print one debit note, or all of an expiry return, on A4 */
export function printDebitNote(returns: readonly PurchaseReturn[]) {
  if (!returns.length) return;
  const shop = useSettingsStore.getState().shop;
  const r = returns[0];
  const s = useSupplierStore
    .getState()
    .suppliers.find((x) => x.id === r.supplierId);
  printHtml({
    html: debitNoteHtml({
      shop: { ...shop, drugLicenseNo: shop.drugLicense },
      supplier: {
        name: r.supplierName,
        gstin: r.supplierGstin,
        address: s ? [s.address, s.city].filter(Boolean).join(", ") : "",
        phone: s?.phone,
        drugLicenseNo: s?.drugLicenseNo,
      },
      returns,
    }),
    // A4: the print dialog asks which printer (the counter one is thermal)
  }).catch((e: Error) => toast.error(e.message));
}
