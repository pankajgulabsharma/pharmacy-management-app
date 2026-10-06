import { describe, expect, it } from "vitest";
import { salesInsights } from "./reports";

/** 8 weeks of FIXED sales: Monday ₹5,000 · Sunday ₹1,000 · other days ₹3,000 */
function weeks(n: number) {
  const out: { date: string; amountPaise: number; count: number }[] = [];
  const start = new Date(2026, 6, 6); // a Monday
  for (let i = 0; i < n * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const wd = d.getDay();
    const rupees = wd === 1 ? 5000 : wd === 0 ? 1000 : 3000;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ date: iso, amountPaise: rupees * 100, count: 1 });
  }
  return out;
}

describe("sales insights (fixed data — never flaky)", () => {
  it("finds the busiest and quietest weekday", () => {
    const i = salesInsights(weeks(8));
    expect(i.busiestWeekday).toBe(1); // Monday
    expect(i.quietestWeekday).toBe(0); // Sunday
  });

  it("says nothing about weekdays until every weekday has data", () => {
    const i = salesInsights(weeks(1).slice(0, 5));
    expect(i.busiestWeekday).toBeNull();
  });
});
