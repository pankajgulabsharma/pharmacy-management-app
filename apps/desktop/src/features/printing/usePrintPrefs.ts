import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PaperFormat } from "@medicare/domain/printing/receipt";
import { PAPER_FORMATS } from "@medicare/domain/printing/receipt";
import { LABEL_SIZES, type LabelSize } from "@medicare/domain/printing/labels";

/**
 * Printer choices for THIS computer — each counter can have a different
 * printer (thermal at the billing counter, A4 laser in the office), so
 * this is remembered on the computer, not on the server.
 */
type PrintPrefs = {
  format: PaperFormat;
  /** Installed app: print straight to this printer (no dialog). "" = ask */
  printer: string;
  copies: number;
  labelSize: LabelSize;
  labelPrinter: string;
  set: (p: Partial<Omit<PrintPrefs, "set">>) => void;
};

const clean = (p: Partial<PrintPrefs>): Partial<PrintPrefs> => ({
  format: p.format && p.format in PAPER_FORMATS ? p.format : "thermal80",
  printer: typeof p.printer === "string" ? p.printer.slice(0, 200) : "",
  copies:
    typeof p.copies === "number" && p.copies >= 1 && p.copies <= 3
      ? Math.floor(p.copies)
      : 1,
  labelSize: p.labelSize && p.labelSize in LABEL_SIZES ? p.labelSize : "50x25",
  labelPrinter:
    typeof p.labelPrinter === "string" ? p.labelPrinter.slice(0, 200) : "",
});

export const usePrintPrefs = create<PrintPrefs>()(
  persist(
    (set) => ({
      format: "thermal80",
      printer: "",
      copies: 1,
      labelSize: "50x25",
      labelPrinter: "",
      set: (p) => set(p),
    }),
    {
      name: "medicare-print",
      version: 1,
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      ),
      partialize: ({ set: _s, ...rest }) => rest,
      merge: (persisted, current) => ({
        ...current,
        ...clean((persisted ?? {}) as Partial<PrintPrefs>),
      }),
    },
  ),
);
