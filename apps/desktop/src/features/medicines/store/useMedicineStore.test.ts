import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockMedicines } from "@medicare/demo/data/mockMedicines";
import type { MedicineInput } from "@medicare/domain/medicines/types";
import { useMedicineStore } from "./useMedicineStore";

const initial = useMedicineStore.getState();
beforeEach(() => useMedicineStore.setState(initial, true));
afterEach(() => vi.unstubAllGlobals());

const { id: _id, ...input } = mockMedicines[0];
const asInput = input as MedicineInput;
const reply = (body: unknown, status = 200) =>
  Promise.resolve(
    status === 204
      ? new Response(null, { status })
      : new Response(JSON.stringify(body), { status }),
  );
const store = () => useMedicineStore.getState();

describe("saving medicines goes through the server", () => {
  it("without a server connection, a change is refused — never 'saved' and lost", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(store().addMedicine(asInput)).rejects.toThrow(
      /Server offline/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(store().medicines).toHaveLength(mockMedicines.length);
  });

  it("add: sends a POST and shows what the server saved (with its id)", async () => {
    useMedicineStore.setState({ source: "server" });
    const fetchSpy = vi.fn(() => reply({ ...asInput, id: "med_db_1" }, 201));
    vi.stubGlobal("fetch", fetchSpy);
    const saved = await store().addMedicine(asInput);
    expect(saved.id).toBe("med_db_1");
    expect(store().medicines[0].id).toBe("med_db_1");
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toMatch(/\/api\/medicines$/);
    expect(init.method).toBe("POST");
  });

  it("a refusal from the server (e.g. has stock) leaves the list unchanged", async () => {
    useMedicineStore.setState({ source: "server" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply({ error: "This medicine still has stock" }, 409)),
    );
    await expect(store().removeMedicine(mockMedicines[0].id)).rejects.toThrow(
      /still has stock/,
    );
    expect(store().medicines.some((m) => m.id === mockMedicines[0].id)).toBe(
      true,
    );
  });

  it("delete: removed from the list only after the server says done (204)", async () => {
    useMedicineStore.setState({ source: "server" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(null, 204)),
    );
    await store().removeMedicine(mockMedicines[0].id);
    expect(store().medicines.some((m) => m.id === mockMedicines[0].id)).toBe(
      false,
    );
  });
});
