/**
 * Medicine Library — about 2.4 lakh Indian medicines (name, company, pack,
 * salt, printed price) to fill the medicine form in one click instead of
 * typing. Data: A-Z Medicine Dataset of India (Kaggle), CC BY-SA 4.0.
 *
 * The library only SUGGESTS: prices are from Nov 2022, and HSN / GST /
 * schedule are guesses the shop confirms from the pack.
 */
import { DEFAULT_GST_RATE } from "../lib/gst";
import type { DrugSchedule } from "./schedule";
import type { MedicineCategory, MedicineFormValues, PackUnit } from "./types";

export const LIBRARY_CREDIT =
  "Medicine data: A-Z Medicine Dataset of India (Kaggle), CC BY-SA 4.0";

export type LibraryItem = {
  id: number;
  name: string;
  company: string;
  /** Printed price of the pack in Nov 2022 (0 = unknown) */
  mrpPaise: number;
  /** "strip of 10 tablets", "bottle of 100 ml Syrup" */
  pack: string;
  salt: string;
};

/** Schedule H1 — G.S.R. 588(E), 30 Aug 2013 (46 drugs) */
export const H1_DRUGS = [
  "Alprazolam",
  "Balofloxacin",
  "Buprenorphine",
  "Capreomycin",
  "Cefdinir",
  "Cefditoren",
  "Cefepime",
  "Cefetamet",
  "Cefixime",
  "Cefoperazone",
  "Cefotaxime",
  "Cefpirome",
  "Cefpodoxime",
  "Ceftazidime",
  "Ceftibuten",
  "Ceftizoxime",
  "Ceftriaxone",
  "Chlordiazepoxide",
  "Clofazimine",
  "Codeine",
  "Cycloserine",
  "Diazepam",
  "Diphenoxylate",
  "Doripenem",
  "Ertapenem",
  "Ethambutol",
  "Ethionamide",
  "Feropenem",
  "Gemifloxacin",
  "Imipenem",
  "Isoniazid",
  "Levofloxacin",
  "Meropenem",
  "Midazolam",
  "Moxifloxacin",
  "Nitrazepam",
  "Pentazocine",
  "Prulifloxacin",
  "Pyrazinamide",
  "Rifabutin",
  "Rifampicin",
  "Para-aminosalicylate",
  "Sparfloxacin",
  "Thiacetazone",
  "Tramadol",
  "Zolpidem",
] as const;

/** Spelling variants used on Indian labels */
const H1_RE = new RegExp(
  `\\b(${[...H1_DRUGS, "Rifampin", "Aminosalicylic", "Faropenem"]
    .map((d) => d.replace(/-/g, "[- ]?"))
    .join("|")})`,
  "i",
);

/** H1 when the salt has an H1 drug; otherwise left for the shop to choose */
export const suggestSchedule = (salt: string): DrugSchedule =>
  H1_RE.test(salt) ? "H1" : "";

const FORM_CATEGORY: [RegExp, MedicineCategory][] = [
  [/\b(drops?|eye|ear|nasal|ophthalmic|opthalmic)\b/i, "drops"],
  [/\b(inhaler|respules?|rotacaps?|inhalation|mdi|dpi)\b/i, "inhaler"],
  [/\b(injection|infusion|injections)\b/i, "injection"],
  [/\b(tablets?|capsules?|caplets?)\b/i, "tablet_capsule"],
  [/\b(cream|ointment|gel|lotion|balm|emulsion)\b/i, "cream_ointment"],
  [
    /\b(syrup|suspension|solution|liquid|expectorant|elixir|linctus|tonic)\b/i,
    "syrup_suspension",
  ],
  [/\b(sachets?|granules|powder)\b/i, "sachet_powder"],
];

/**
 * "strip of 15 tablets" → strip pack of 15, loose sale on;
 * "bottle of 100 ml Syrup" → bottle; anything else → one pack.
 */
export function parsePack(label: string): {
  unit: PackUnit;
  unitsPerStrip: number;
  allowLoose: boolean;
  category: MedicineCategory;
} {
  const m = /^\s*([a-z ]+?)\s+of\s+(\d+)\s*(.*)$/i.exec(label);
  const container = m?.[1].toLowerCase() ?? "";
  const count = m ? Number(m[2]) : 1;
  const form = m?.[3] ?? label;
  const category =
    FORM_CATEGORY.find(([re]) => re.test(form))?.[1] ??
    (container === "sachet" ? "sachet_powder" : "other");
  if (container === "strip" && count >= 2 && count <= 500)
    return { unit: "STP", unitsPerStrip: count, allowLoose: true, category };
  return { unit: "BTL", unitsPerStrip: 1, allowLoose: false, category };
}

const rupees = (paise: number) =>
  paise > 0 ? (paise / 100).toFixed(2).replace(/\.00$/, "") : "";

/** A library medicine → the "Add medicine" form, ready to check and save */
export function libraryToForm(
  item: LibraryItem,
  base: MedicineFormValues,
): MedicineFormValues {
  const p = parsePack(item.pack);
  return {
    ...base,
    name: item.name.slice(0, 120),
    salt: item.salt,
    brand: item.company,
    category: p.category,
    unit: p.unit,
    unitsPerStrip: String(p.unitsPerStrip),
    allowLoose: p.allowLoose,
    // Medicines (chapter 30) — the shop checks the exact HSN on the bill
    hsn: base.hsn || "3004",
    gstPercent: base.gstPercent ?? DEFAULT_GST_RATE,
    mrp: rupees(item.mrpPaise),
    salePrice: rupees(item.mrpPaise),
    schedule: suggestSchedule(item.salt) || base.schedule,
  };
}
