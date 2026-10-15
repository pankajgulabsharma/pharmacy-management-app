import { useCallback } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  whatsappLink,
  whatsappNumber,
  type WhatsAppVia,
} from "@medicare/domain/printing/whatsapp";

/**
 * How THIS computer opens WhatsApp (Settings → Printing & WhatsApp):
 * the Desktop app if it's installed, else WhatsApp Web in the browser.
 */
type WhatsAppPrefs = {
  via: WhatsAppVia;
  set: (via: WhatsAppVia) => void;
};

export const useWhatsAppPrefs = create<WhatsAppPrefs>()(
  persist((set) => ({ via: "web", set: (via) => set({ via }) }), {
    name: "medicare-whatsapp",
    version: 1,
    storage: createJSONStorage(() =>
      typeof window !== "undefined"
        ? window.localStorage
        : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    ),
    partialize: ({ via }) => ({ via }),
    merge: (persisted, current) => {
      const via = (persisted as Partial<WhatsAppPrefs> | null)?.via;
      return { ...current, via: via === "app" ? "app" : "web" };
    },
  }),
);

/**
 * Opens WhatsApp with the message typed. `phone` = a 10-digit mobile, or
 * null/"" to choose the chat in WhatsApp (a group, a contact…).
 * Returns false when a phone was given but isn't a valid Indian mobile.
 */
export function useOpenWhatsApp() {
  const via = useWhatsAppPrefs((s) => s.via);
  return useCallback(
    (phone: string | null, text: string): boolean => {
      const n = phone?.trim() ? whatsappNumber(phone) : null;
      if (phone?.trim() && !n) return false;
      window.open(whatsappLink(n, text, via), "_blank");
      return true;
    },
    [via],
  );
}
