/**
 * Makes the Medicine Library file from the A-Z Medicine Dataset of India
 * (Kaggle, CC BY-SA 4.0 — see apps/server/library/README.md).
 *
 *   npm run library:build -w @medicare/server -- path/to/A_Z_medicines_dataset_of_India.csv
 *
 * Keeps what a shop needs to fill a medicine form: name, company, pack,
 * salt and the printed price. Discontinued products and repeats are
 * dropped. Output: library/medicines.tsv.br (small enough for git; the
 * server turns it into a searchable index on first start).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants } from "node:zlib";
import { parseCsv, normalizeHeader } from "@medicare/domain/lib/csv";

const src = process.argv[2];
if (!src) {
  console.error("Usage: library:build -- <A_Z_medicines_dataset_of_India.csv>");
  process.exit(1);
}
const out = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../library/medicines.tsv.br",
);

const [head, ...rows] = parseCsv(readFileSync(src, "utf8"));
const col = (name: string) => {
  const i = head.map(normalizeHeader).indexOf(name);
  if (i < 0) throw new Error(`Column "${name}" not found`);
  return i;
};
const C = {
  name: col("name"),
  price: col("price"),
  gone: col("is discontinued"),
  company: col("manufacturer name"),
  pack: col("pack size label"),
  salt1: col("short composition1"),
  salt2: col("short composition2"),
};

/** One line, no tabs, single spaces */
const tidy = (s = "") => s.replace(/\s+/g, " ").trim();
/** "Amoxycillin  (500mg) " → "Amoxycillin (500mg)" */
const salt = (s = "") => tidy(s).replace(/\s+\)/g, ")").replace(/\(\s+/g, "(");

const seen = new Set<string>();
const lines: string[] = [];
let dropped = 0;
for (const r of rows) {
  const name = tidy(r[C.name]);
  const pack = tidy(r[C.pack]);
  if (!name || /^true$/i.test(r[C.gone] ?? "")) {
    dropped++;
    continue;
  }
  const key = `${name.toLowerCase()}|${pack.toLowerCase()}`;
  if (seen.has(key)) {
    dropped++;
    continue;
  }
  seen.add(key);
  const price = Number(r[C.price]);
  const mrpPaise =
    Number.isFinite(price) && price > 0 ? Math.round(price * 100) : 0;
  const salts = [salt(r[C.salt1]), salt(r[C.salt2])].filter(Boolean);
  lines.push(
    [name, tidy(r[C.company]), mrpPaise, pack, salts.join(" + ")].join("\t"),
  );
}

// Sorted by name: better compression, and the order users expect
lines.sort((a, b) => a.localeCompare(b));
const text = `name\tcompany\tmrp_paise\tpack\tsalt\n${lines.join("\n")}\n`;
const br = brotliCompressSync(Buffer.from(text), {
  params: {
    [constants.BROTLI_PARAM_QUALITY]: 11,
    [constants.BROTLI_PARAM_LGWIN]: 24,
    [constants.BROTLI_PARAM_SIZE_HINT]: text.length,
  },
});
writeFileSync(out, br);
console.log(
  `${lines.length} medicines (${dropped} discontinued / repeated dropped) → ${out} (${(br.length / 1e6).toFixed(1)} MB)`,
);
