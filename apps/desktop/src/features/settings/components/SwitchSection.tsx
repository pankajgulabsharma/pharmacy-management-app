import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookUser, Pill, ReceiptText, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "@/lib/i18n";
import { SettingsCard } from "./SettingsCard";
import { PartyImportDialog, type PartyKind } from "./PartyImportDialog";

/**
 * A shop moving from other software (Marg, Tally, GoFrugal, Busy, a khata
 * book…): what to bring over, in which order, and what to leave behind.
 */
export function SwitchSection() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<PartyKind | null>(null);

  const steps = [
    {
      icon: Pill,
      title: "Medicines & stock in hand",
      text: "Old software → Stock / Item list → Export → CSV (with batch, expiry, quantity, MRP and purchase rate). Each batch comes in with its expiry, so FEFO and expiry alerts work from day one.",
      action: (
        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-lg text-[11px]"
          onClick={() => navigate("/medicines?import=1")}
        >
          {tr("Import medicines & stock")}
        </Button>
      ),
    },
    {
      icon: BookUser,
      title: "Customers & their old udhaar",
      text: "Party / outstanding list → CSV. Each customer's balance becomes “Old udhaar” — the first line of their khata, paid off like any udhaar.",
      action: (
        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-lg text-[11px]"
          onClick={() => setKind("customers")}
        >
          {tr("Import customers")}
        </Button>
      ),
    },
    {
      icon: Truck,
      title: "Suppliers & what you still owe them",
      text: "Supplier list with outstanding → CSV. Each supplier's dues become an “Old balance” you pay off from Purchases — not counted as a purchase, no stock, no GST. One supplier: Suppliers → View → Add old balance.",
      action: (
        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-lg text-[11px]"
          onClick={() => setKind("suppliers")}
        >
          {tr("Import suppliers")}
        </Button>
      ),
    },
    {
      icon: ReceiptText,
      title: "Old bills stay in the old software",
      text: "Don't bring old bills over: their GST is already filed from there. Pick a start day (best: 1st of a month or 1 April), stop billing in the old software that day, and keep it (or its backup) only to look up old bills. Give MediCare its own bill prefix (Settings → Billing, e.g. MC) so new bill numbers never clash with the old software's — a new series is allowed under GST.",
      action: null,
    },
  ];

  return (
    <div className="space-y-3">
      <SettingsCard
        title="Coming from another software?"
        description="Bring over what the shop needs to keep working — in this order. Importing twice never doubles anything."
      >
        <ol className="space-y-2.5">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="flex items-start gap-3 rounded-lg border border-border/70 p-3"
            >
              <span className="h-7 w-7 shrink-0 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold flex items-center gap-1.5">
                  <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {tr(s.title)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {tr(s.text)}
                </p>
              </div>
              {s.action ? <div className="shrink-0">{s.action}</div> : null}
            </li>
          ))}
        </ol>
        <p className="text-[10px] text-muted-foreground">
          {tr(
            "Tip: after importing, check Reports → Stock (value) and the Customers / Suppliers totals against the old software's closing figures of the same day.",
          )}
        </p>
      </SettingsCard>
      <PartyImportDialog kind={kind} onClose={() => setKind(null)} />
    </div>
  );
}
