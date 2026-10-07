import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockMedicines } from "@medicare/demo/data/mockMedicines";
import { mockSuppliers } from "@medicare/demo/data/mockSuppliers";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { useSupplierStore } from "@/features/suppliers/store/useSupplierStore";

/** A stand-in for the browser's EventSource, driven by the test */
class FakeStream {
  static last: FakeStream;
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners: ((e: { data: string }) => void)[] = [];
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeStream.last = this;
  }
  private patchListeners: ((e: { data: string }) => void)[] = [];
  addEventListener(type: string, fn: (e: { data: string }) => void) {
    (type === "patch" ? this.patchListeners : this.listeners).push(fn);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  drop() {
    this.readyState = 0;
    this.onerror?.();
  }
  emitPatch(patch: object) {
    for (const fn of this.patchListeners) fn({ data: JSON.stringify(patch) });
  }
  announce(topic: string) {
    for (const fn of this.listeners) fn({ data: JSON.stringify({ topic }) });
  }
}

const reply = (body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const flush = () => new Promise((r) => setTimeout(r, 0));
let calls: string[] = [];
let medName = "Dolo 650 Tablet";

beforeEach(async () => {
  vi.resetModules();
  calls = [];
  medName = "Dolo 650 Tablet";
  vi.stubGlobal("EventSource", FakeStream);
  vi.stubGlobal("window", { addEventListener: vi.fn() });
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const path = new URL(url).pathname;
      calls.push(path);
      if (path === "/api/medicines")
        return reply({ items: [{ ...mockMedicines[0], name: medName }] });
      if (path === "/api/suppliers") return reply({ items: mockSuppliers });
      // stock & money lists (contents don't matter for these tests)
      return reply({
        items: [],
        batches: [],
        movements: [],
        purchases: [],
        returns: [],
        sales: [],
        saleReturns: [],
        customers: [],
        payments: [],
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

async function connected() {
  const { useServerStore } = await import("./useServerStore");
  useServerStore.getState().connect();
  FakeStream.last.open();
  await flush();
  await flush();
  return useServerStore;
}

describe("live updates — no refresh", () => {
  it("on connect: loads everything and turns green", async () => {
    const srv = await connected();
    expect(srv.getState().status).toBe("online");
    expect(calls.sort()).toEqual([
      "/api/customers",
      "/api/held",
      "/api/medicines",
      "/api/purchases",
      "/api/sales",
      "/api/stock",
      "/api/suppliers",
    ]);
  });

  it("a save announced by the server reloads ONLY that part, by itself", async () => {
    await connected();
    const { useMedicineStore: med } =
      await import("@/features/medicines/store/useMedicineStore");
    calls = [];
    medName = "Changed on counter 2";
    FakeStream.last.announce("medicines");
    await flush();
    await flush();
    expect(calls).toEqual(["/api/medicines"]);
    expect(med.getState().medicines[0].name).toBe("Changed on counter 2");
  });

  it("server stops → red light; it comes back → reloads and turns green again", async () => {
    const srv = await connected();
    FakeStream.last.drop();
    expect(srv.getState().status).toBe("offline");
    calls = [];
    FakeStream.last.open(); // the browser reconnected on its own
    await flush();
    await flush();
    expect(srv.getState().status).toBe("online");
    expect(calls.length).toBe(7);
  });
});

describe("suppliers are saved through the server", () => {
  beforeEach(() => {
    useSupplierStore.setState({ suppliers: mockSuppliers, source: "demo" });
    useMedicineStore.setState({ source: "demo" });
  });

  it("without a server, a save is refused (never lost on refresh)", async () => {
    const { id: _i, createdAt: _c, ...input } = mockSuppliers[0];
    await expect(
      useSupplierStore.getState().updateSupplier(mockSuppliers[0].id, input),
    ).rejects.toThrow(/Server offline/);
  });

  it("a duplicate name is refused at once, before any call to the server", async () => {
    useSupplierStore.setState({ source: "server" });
    const { id: _i, createdAt: _c, ...input } = mockSuppliers[0];
    calls = [];
    await expect(
      useSupplierStore.getState().addSupplier({ ...input, gstin: input.gstin }),
    ).rejects.toThrow(/already/);
    expect(calls).toEqual([]);
  });
});

describe("a bill saved on another counter", () => {
  it("arrives as a patch and is merged — no reload at all", async () => {
    await connected();
    const { useSalesStore } =
      await import("@/features/billing/store/useSalesStore");
    calls = [];
    const bill = { id: "s_other", billNo: "INV-9999" };
    FakeStream.last.emitPatch({ sales: [bill], heldRemoved: [] });
    expect(calls).toEqual([]);
    expect(useSalesStore.getState().sales[0]).toMatchObject(bill);
  });
});
