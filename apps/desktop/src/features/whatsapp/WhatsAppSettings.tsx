import { useWhatsAppPrefs } from "./useWhatsApp";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

const OPTIONS = [
  {
    via: "web",
    title: "WhatsApp Web (browser)",
    hint: "Works on every computer. Sign in once at web.whatsapp.com with the shop phone's QR code — it stays signed in.",
  },
  {
    via: "app",
    title: "WhatsApp Desktop app",
    hint: "If WhatsApp is installed on this computer (Microsoft Store, free) — the chat opens straight in the app.",
  },
] as const;

/** How THIS computer opens WhatsApp (bills, orders, refill reminders) */
export function WhatsAppSettings() {
  const via = useWhatsAppPrefs((s) => s.via);
  const set = useWhatsAppPrefs((s) => s.set);
  return (
    <div className="space-y-3 p-4">
      <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <button
            key={o.via}
            type="button"
            role="radio"
            aria-checked={via === o.via}
            onClick={() => set(o.via)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              via === o.via
                ? "border-[#25D366] bg-[#25D366]/10"
                : "border-border hover:bg-muted/50",
            )}
          >
            <p className="text-[12px] font-semibold">{tr(o.title)}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {tr(o.hint)}
            </p>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {tr(
          "No contact needs to be saved in the phone: a bill goes straight to the customer's mobile; with no mobile, WhatsApp asks which chat. A number that isn't on WhatsApp can't receive messages.",
        )}
      </p>
    </div>
  );
}
