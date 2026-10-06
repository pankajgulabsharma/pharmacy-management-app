import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: the rules must run on the SERVER too, where there is no React,
 * no browser and no app stores. Any such import here is a bug.
 */
const FORBIDDEN = [/from "react/, /from "@\//, /from "zustand/, /from "i18next/, /\bwindow\./, /\bdocument\./, /\blocalStorage\b/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.ts$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });
}

describe("@medicare/domain stays pure", () => {
  const all = files(join(import.meta.dirname, "."));
  it("has the business rules", () => {
    expect(all.length).toBeGreaterThan(40);
  });
  it.each(all.map((f) => [f.split("/src/")[1], f]))("%s imports no UI, browser or store code", (_name, file) => {
    const src = readFileSync(file as string, "utf8");
    const hits = FORBIDDEN.filter((re) => re.test(src)).map(String);
    expect(hits).toEqual([]);
  });
});
