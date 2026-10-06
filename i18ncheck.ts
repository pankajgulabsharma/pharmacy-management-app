import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import i18n from "./src/lib/i18n";
const files: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !/\.test\./.test(f) && files.push(p); } };
walk("src");
const used = new Set<string>(); const usedIn = new Map<string, string>();
for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(/\bt\(\s*["'`]([\w.]+)["'`]/g)) { used.add(m[1]); usedIn.set(m[1], f.replace("src/", "")); }
const has = (lng: string, k: string) => i18n.exists(k, { lng, fallbackLng: false } as never);
const missEn = [...used].filter((k) => !has("en", k)), missHi = [...used].filter((k) => !has("hi", k));
console.log("t() keys used:", used.size, "| missing in en:", missEn.length, "| missing in hi:", missHi.length);
console.log("missing en:", missEn.slice(0, 20).map((k) => `${k} (${usedIn.get(k)})`));
console.log("missing hi:", missHi.slice(0, 10));
const withT = new Set(files.filter((f) => /\bt\(/.test(readFileSync(f, "utf8"))).map((f) => f.replace("src/", "")));
const tsx = files.filter((f) => f.endsWith(".tsx") && !f.includes("components/ui/"));
console.log(`screens/components using translation: ${withT.size} of ${tsx.length} .tsx files`);
