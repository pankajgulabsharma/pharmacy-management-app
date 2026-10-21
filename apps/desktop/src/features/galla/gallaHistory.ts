import { create } from "zustand";
import { differenceOf, type CashDay } from "@medicare/domain/cash/galla";
import { formatPaise } from "@medicare/domain/lib/money";
import { apiGet } from "@/lib/api";
import { toCsv } from "@/lib/csv";

type History = {
  key: string;
  days: CashDay[];
  perCounter: boolean;
  load: (from: string, to: string) => Promise<void>;
};

/** Closed (and open) galla days of a period — Reports → Galla */
export const useGallaHistory = create<History>()((set) => ({
  key: "",
  days: [],
  perCounter: false,
  load: async (from, to) => {
    const key = `${from}|${to}`;
    const r = await apiGet<{ days: CashDay[]; perCounter: boolean }>(
      `/api/galla/history?from=${from}&to=${to}`,
    );
    set({ key, days: r.days, perCounter: r.perCounter });
  },
}));

/** The period's galla days as a CSV (Reports "Export CSV") */
export function gallaCsv(): string {
  const { days } = useGallaHistory.getState();
  const rs = (p: number | null) =>
    p === null ? "" : formatPaise(p).replace(/,/g, "");
  return toCsv(days, [
    { header: "Date", value: (d) => d.date },
    { header: "Counter", value: (d) => d.counter },
    { header: "Status", value: (d) => d.status },
    { header: "Opening", value: (d) => rs(d.openingPaise) },
    { header: "Should be", value: (d) => rs(d.expectedPaise) },
    { header: "Counted", value: (d) => rs(d.countedPaise) },
    { header: "Difference", value: (d) => rs(differenceOf(d)) },
    { header: "Left for tomorrow", value: (d) => rs(d.keptPaise) },
    {
      header: "Taken out",
      value: (d) =>
        d.countedPaise !== null && d.keptPaise !== null
          ? rs(d.countedPaise - d.keptPaise)
          : "",
    },
    { header: "Opened by", value: (d) => d.openedBy },
    { header: "Closed by", value: (d) => d.closedBy },
    { header: "Note", value: (d) => d.note },
  ]);
}
