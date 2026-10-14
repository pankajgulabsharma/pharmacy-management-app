import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { openDatabase } from "../db/client";
import { seedDemoData } from "../db/seed";
import { signIn } from "../test/signIn";
import { ftsQuery, openLibrary, type Library } from "./library";

const dir = mkdtempSync(join(tmpdir(), "medlib-"));
const data = join(dir, "medicines.tsv.br");
writeFileSync(
  data,
  brotliCompressSync(
    [
      "name\tcompany\tmrp_paise\tpack\tsalt",
      "Dolo 650 Tablet\tMicro Labs Ltd\t3070\tstrip of 15 tablets\tParacetamol (650mg)",
      "Calpol 500mg Tablet\tGSK\t1500\tstrip of 15 tablets\tParacetamol (500mg)",
      "Taxim-O 200 Tablet\tAlkem\t10900\tstrip of 10 tablets\tCefixime (200mg)",
      "Ascoril LS Syrup\tGlenmark\t11800\tbottle of 100 ml Syrup\tAmbroxol (30mg/5ml) + Levosalbutamol (1mg/5ml)",
    ].join("\n"),
  ),
);
const ready = async (lib: Library) => {
  for (let i = 0; i < 100 && lib.status() === "building"; i++)
    await new Promise((r) => setTimeout(r, 20));
  return lib;
};
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("Medicine Library", () => {
  it("builds the index once, in the background", async () => {
    const file = join(dir, "lib.sqlite");
    const lib = openLibrary(file, data, () => {});
    expect(lib.status()).toBe("building");
    expect(lib.search("dolo")).toEqual([]);
    await ready(lib);
    expect(lib.status()).toBe("ready");
    lib.close();
    // Same data file → opens straight away, no rebuild
    const again = openLibrary(file, data, () => {});
    expect(again.status()).toBe("ready");
    again.close();
  });

  it("finds by name or salt, name starts first", async () => {
    const lib = await ready(openLibrary(join(dir, "s.sqlite"), data, () => {}));
    expect(lib.search("dolo 65")[0]).toMatchObject({
      name: "Dolo 650 Tablet",
      company: "Micro Labs Ltd",
      mrpPaise: 3070,
      pack: "strip of 15 tablets",
    });
    expect(
      lib
        .search("paracetamol")
        .map((x) => x.name)
        .sort(),
    ).toEqual(["Calpol 500mg Tablet", "Dolo 650 Tablet"]);
    // FTS syntax typed by a user is just text
    expect(lib.search('"taxim*')[0]?.name).toBe("Taxim-O 200 Tablet");
    expect(lib.search("x")).toEqual([]);
    lib.close();
  });

  it("query words become quoted prefixes", () => {
    expect(ftsQuery("Dolo 650")).toBe('"dolo"* "650"*');
    expect(ftsQuery('a"b')).toBe('"a"* "b"*');
    expect(ftsQuery("  ")).toBeNull();
  });

  it("GET /api/library/search", async () => {
    const database = await openDatabase(":memory:");
    await seedDemoData(database);
    const library = await ready(
      openLibrary(join(dir, "api.sqlite"), data, () => {}),
    );
    const app = buildApp({ database, library });
    const auth = await signIn(app);
    const res = await app.inject({
      url: "/api/library/search?q=ascoril&limit=5",
      headers: auth,
    });
    expect(res.json()).toMatchObject({
      status: "ready",
      items: [{ name: "Ascoril LS Syrup", mrpPaise: 11800 }],
    });
    expect(
      (await app.inject({ url: "/api/library/search?q=ascoril" })).statusCode,
    ).toBe(401);
    await app.close();
    library.close();
    database.close();
  });
});
