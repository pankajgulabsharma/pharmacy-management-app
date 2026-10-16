import { describe, expect, it } from "vitest";
import {
  broadcastAddresses,
  findMainComputers,
  startDiscovery,
} from "./discovery";

describe("find the main computer on the shop network", () => {
  it("a counter's question gets the shop name and address back", async () => {
    const port = 41000 + Math.floor(Math.random() * 500);
    const stop = await startDiscovery({
      httpPort: 4000,
      shopName: () => "Shree Sai Medical",
      port,
    });
    try {
      const found = await findMainComputers({
        port,
        targets: ["127.0.0.1"],
        timeoutMs: 400,
      });
      expect(found).toEqual([
        { url: "http://127.0.0.1:4000", shop: "Shree Sai Medical" },
      ]);
    } finally {
      stop();
    }
  });

  it("nobody sharing → empty list, quickly", async () => {
    const found = await findMainComputers({
      port: 41999,
      targets: ["127.0.0.1"],
      timeoutMs: 200,
    });
    expect(found).toEqual([]);
  });

  it("always asks the whole network", () => {
    expect(broadcastAddresses()).toContain("255.255.255.255");
  });
});
