import { create } from "zustand";
import { persist } from "zustand/middleware";

type UIState = {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  /** Billing: show the full stats + recent sales under the bill (off = compact strip) */
  billingDetails: boolean;
  toggleBillingDetails: () => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      billingDetails: false,
      toggleBillingDetails: () =>
        set((s) => ({ billingDetails: !s.billingDetails })),
    }),
    {
      name: "pharmacy-ui",
      partialize: (s) => ({
        sidebarOpen: s.sidebarOpen,
        billingDetails: s.billingDetails,
      }),
    },
  ),
);
