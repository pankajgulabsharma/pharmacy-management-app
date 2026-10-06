import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

/** Demo sales must cover every day of the last 90 — at ANY time of day */
describe("demo sales history has no empty days", () => {
  it.each(["00:30", "12:00", "19:20", "23:30"])(
    "when the app starts at %s",
    async (hhmm) => {
      const [h, m] = hhmm.split(":").map(Number);
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 9, 5, h, m));
      vi.resetModules();
      const { demoSales } = await import("./seed");

      const days = new Set(
        demoSales.map((s) => new Date(s.createdAt).toDateString()),
      );
      const missing: string[] = [];
      for (let i = 1; i <= 90; i++) {
        const d = new Date(2026, 9, 5 - i);
        if (!days.has(d.toDateString())) missing.push(d.toDateString());
      }
      expect(missing).toEqual([]);
    },
  );
});
