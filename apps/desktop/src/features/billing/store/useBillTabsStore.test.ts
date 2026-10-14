import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_BILL_TABS,
  blankDraft,
  useBillTabsStore,
} from "./useBillTabsStore";

const s = () => useBillTabsStore.getState();

describe("bill tabs", () => {
  beforeEach(() => {
    const d = blankDraft();
    useBillTabsStore.setState({ drafts: [d], activeId: d.id });
  });

  it("opens up to 10 bills, the new one becomes active", () => {
    for (let i = 1; i < MAX_BILL_TABS; i++) expect(s().open()).toBe(true);
    expect(s().drafts).toHaveLength(MAX_BILL_TABS);
    expect(s().activeId).toBe(s().drafts[MAX_BILL_TABS - 1].id);
    expect(s().open()).toBe(false);
  });

  it("each tab keeps its own bill", () => {
    const a = s().activeId;
    s().update(a, { customerName: "Ramesh" });
    s().open({ customerName: "Suresh" });
    const b = s().activeId;
    s().update(b, (d) => ({ customerName: d.customerName + " K" }));
    expect(s().drafts.map((d) => d.customerName)).toEqual([
      "Ramesh",
      "Suresh K",
    ]);
    s().select(a);
    expect(s().activeId).toBe(a);
  });

  it("closing picks the neighbour; the last tab is emptied, never removed", () => {
    const a = s().activeId;
    s().open();
    const b = s().activeId;
    s().close(b);
    expect(s().activeId).toBe(a);
    s().update(a, { customerName: "Ramesh" });
    s().close(a);
    expect(s().drafts).toHaveLength(1);
    expect(s().drafts[0].customerName).toBe("");
  });

  it("junk in storage is cleaned on load", async () => {
    const disk = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => disk.get(k) ?? null,
        setItem: (k: string, v: string) => disk.set(k, v),
        removeItem: (k: string) => disk.delete(k),
      },
    });
    disk.set(
      "medicare-bill-tabs",
      JSON.stringify({
        state: {
          drafts: [
            { id: "x", customerName: 5, cart: [{ lineId: 1 }], payment: "?" },
            null,
          ],
          activeId: "nope",
        },
        version: 1,
      }),
    );
    await useBillTabsStore.persist.rehydrate();
    expect(s().drafts).toHaveLength(1);
    expect(s().drafts[0]).toMatchObject({
      id: "x",
      customerName: "",
      cart: [],
      payment: null,
    });
    expect(s().activeId).toBe("x");
    vi.unstubAllGlobals();
  });
});
