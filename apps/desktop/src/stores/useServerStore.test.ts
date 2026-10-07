import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockMedicines } from "@medicare/demo/data/mockMedicines";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { apiGet, ApiError } from "@/lib/api";
import { useServerStore } from "./useServerStore";

const initial = {
  med: useMedicineStore.getState(),
  srv: useServerStore.getState(),
};
beforeEach(() => {
  useMedicineStore.setState(initial.med, true);
  useServerStore.setState(initial.srv, true);
});
afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("loading medicines from the server", () => {
  it("online: the list comes from the server (database)", async () => {
    const fromDb = [{ ...mockMedicines[0], name: "Dolo 650 TEST" }];
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json({ items: fromDb, count: 1 })),
    );
    await useServerStore.getState().sync();
    expect(useServerStore.getState().status).toBe("online");
    expect(useMedicineStore.getState().source).toBe("server");
    expect(useMedicineStore.getState().medicines[0].name).toBe("Dolo 650 TEST");
  });

  it("offline: says so clearly and loads nothing (nothing half-loaded)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    await useServerStore.getState().sync();
    expect(useServerStore.getState()).toMatchObject({
      status: "offline",
      error: "Server not reachable",
    });
    expect(useMedicineStore.getState().source).toBe("none");
    expect(useMedicineStore.getState().medicines).toHaveLength(0);
    expect(useServerStore.getState().lastSyncAt).toBeNull();
  });

  it("server error: shows the server's message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json({ error: "Something went wrong" }, 500)),
    );
    await expect(apiGet("/api/medicines")).rejects.toMatchObject({
      kind: "http",
      status: 500,
      message: "Something went wrong",
    });
  });

  it("slow server: gives up after the timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_u: string, init: RequestInit) =>
          new Promise((_r, reject) =>
            init.signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            ),
          ),
      ),
    );
    const err = (await apiGet("/api/medicines", 20).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe("timeout");
  });
});
