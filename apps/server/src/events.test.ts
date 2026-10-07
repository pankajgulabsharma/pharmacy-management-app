import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { openDatabase, type Database } from "./db/client";
import { seedDemoData } from "./db/seed";
import { topicOf } from "./events";
import { signIn } from "./test/signIn";

let database: Database;
let app: ReturnType<typeof buildApp>;
let base = "";
let auth: { authorization: string };
let token = "";
beforeAll(async () => {
  database = await openDatabase(":memory:");
  await seedDemoData(database);
  app = buildApp({ database });
  auth = await signIn(app);
  token = auth.authorization.slice(7);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
afterAll(async () => {
  await app.close();
  database.close();
});

/** Opens the live stream and collects the topics it announces */
async function listen() {
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/events?token=${token}`, {
    signal: ctrl.signal,
    headers: { Origin: "http://localhost:5173" },
  });
  const topics: string[] = [];
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const m of dec.decode(value).matchAll(/data: (\{.*\})/g))
          topics.push(JSON.parse(m[1]).topic);
      }
    } catch {
      /* aborted */
    }
  })();
  await new Promise((r) => setTimeout(r, 50));
  return { res, topics, close: () => ctrl.abort() };
}
const wait = () => new Promise((r) => setTimeout(r, 100));

describe("live updates — no refresh needed", () => {
  it("maps URLs to what changed", () => {
    expect(topicOf("/api/medicines/import")).toBe("medicines");
    expect(topicOf("/api/suppliers/sup1?x=1")).toBe("suppliers");
    expect(topicOf("/health")).toBeNull();
  });

  it("every open app hears about a save, and only successful saves", async () => {
    const a = await listen();
    const b = await listen(); // e.g. a second counter
    expect(a.res.headers.get("content-type")).toContain("text/event-stream");
    expect(a.res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );

    const id = (
      database.raw.prepare("SELECT id FROM medicines LIMIT 1").get() as {
        id: string;
      }
    ).id;
    await fetch(`${base}/api/medicines/${id}`, {
      method: "DELETE",
      headers: auth,
    }); // has stock → 409, no news
    await fetch(`${base}/api/suppliers`, { headers: auth }); // a read → no news
    const body = (await (
      await fetch(`${base}/api/medicines/${id}`, { headers: auth })
    ).json()) as Record<string, unknown>;
    delete body.id;
    await fetch(`${base}/api/medicines/${id}`, {
      method: "PUT",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await wait();

    expect(a.topics).toEqual(["medicines"]);
    expect(b.topics).toEqual(["medicines"]);
    a.close();
    b.close();
  });
});
