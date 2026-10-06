import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "./app";

const app = buildApp();
afterAll(() => app.close());

describe("server", () => {
  it("GET /health says it is up", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, service: "medicare-server" });
  });

  it("unknown address → 404", async () => {
    const res = await app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
  });
});
