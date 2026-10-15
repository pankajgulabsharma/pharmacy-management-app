/**
 * Strength & substitutes.
 *
 * A substitute is the SAME medicine under another brand: same salt(s),
 * same strength, same form. Dolo 650 (Paracetamol 650 mg tablet) is NOT a
 * substitute for Calpol 500 or for Paracetamol syrup — giving one for the
 * other is a dosing mistake. So matching uses all three, and a medicine
 * whose strength isn't known is never offered as a substitute.
 */
import type { MedicineCategory } from "./types";

export const STRENGTH_MAX = 40;

/** Units written on Indian packs, in their usual spelling */
const UNIT_RE =
  /(\d+(?:\.\d+)?)\s*(mcg|µg|ug|mg|gm|g|ml|iu|i\.u\.|lac|lakh|%\s*w\/w|%\s*w\/v|%\s*v\/v|%)(?![a-z])/gi;

function unitName(u: string): string {
  const x = u.toLowerCase().replace(/\s+/g, "");
  if (x === "µg" || x === "ug") return "mcg";
  if (x === "gm") return "g";
  if (x === "i.u.") return "iu";
  if (x === "lakh") return "lac";
  return x;
}

/** "650MG" → "650 mg", "250mg/5ml" → "250 mg/5 ml", "0.1 % w/w" → "0.1% w/w" */
export function cleanStrength(raw: string): string {
  const s = raw
    .replace(/[()]/g, " ")
    .replace(UNIT_RE, (_, n: string, u: string) => {
      const unit = unitName(u);
      return unit.startsWith("%")
        ? `${n}%${unit.length > 1 ? ` ${unit.slice(1)}` : ""}`
        : `${n} ${unit}`;
    })
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
  return s.slice(0, STRENGTH_MAX);
}

/** For comparing: "1 g" = "1000 mg", spaces and case ignored */
export function strengthKey(strength: string): string {
  return cleanStrength(strength)
    .toLowerCase()
    .replace(/(\d+(?:\.\d+)?) g\b/g, (_, n: string) => `${Number(n) * 1000} mg`)
    .replace(/\s+/g, "");
}

/** Spellings that mean the same ingredient on Indian labels */
const SAME_SALT: Record<string, string> = {
  amoxycillin: "amoxicillin",
  "clavulanate potassium": "clavulanic acid",
  "potassium clavulanate": "clavulanic acid",
  clavulanate: "clavulanic acid",
  cephalexin: "cefalexin",
  acetaminophen: "paracetamol",
  "vitamin c": "ascorbic acid",
  rifampin: "rifampicin",
  frusemide: "furosemide",
  salbutamol: "salbutamol",
  albuterol: "salbutamol",
  "levo-cetirizine": "levocetirizine",
};

function ingredientName(part: string): string {
  const n = part
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return SAME_SALT[n] ?? n;
}

/**
 * The library writes salts with their strengths:
 * "Amoxycillin (500mg) + Clavulanic Acid (125mg)" →
 * { salt: "Amoxycillin + Clavulanic Acid", strength: "500 mg + 125 mg" }
 * (strength only when EVERY ingredient has one).
 */
export function splitSalt(raw: string): { salt: string; strength: string } {
  const parts = raw
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  const names = parts.map((p) =>
    p
      .replace(/\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  const values = parts.map((p) => /\(([^)]*)\)/.exec(p)?.[1]?.trim() ?? "");
  const strength = values.every((v) => v && /\d/.test(v))
    ? cleanStrength(values.join(" + "))
    : "";
  return { salt: names.join(" + "), strength };
}

/** Forms where a bare number in the name is the strength ("Dolo 650") */
const BARE_NUMBER_FORMS: ReadonlySet<MedicineCategory> = new Set([
  "tablet_capsule",
]);

/**
 * Best guess of the strength from what is already written, for medicines
 * saved before the Strength field existed. Only a suggestion — the shop
 * confirms it from the pack.
 *  1. salt with strengths in brackets (library style)
 *  2. a number WITH a unit in the name or salt ("Pan 40mg", "Azee 500 mg")
 *  3. tablets: a lone number in the name ("Dolo 650 Tablet" → 650 mg)
 */
export function guessStrength(m: {
  name: string;
  salt: string;
  category: MedicineCategory;
}): string {
  const fromSalt = splitSalt(m.salt).strength;
  if (fromSalt) return fromSalt;
  for (const text of [m.name, m.salt]) {
    const found = [...text.matchAll(UNIT_RE)].map((x) => x[0]);
    if (found.length) return cleanStrength(found.join(" + "));
  }
  if (BARE_NUMBER_FORMS.has(m.category)) {
    const bare = /(?:^|\s)(\d{1,4}(?:\.\d+)?)(?=\s|$)/.exec(m.name)?.[1];
    const n = Number(bare);
    if (bare && n >= 1 && n <= 2000) return `${bare} mg`;
  }
  return "";
}

/**
 * What a medicine IS, for finding substitutes: ingredients (any order,
 * spelling variants merged) + strength + form. null = can't tell (no salt
 * or no strength) → never matched.
 */
export function compositionKey(m: {
  salt: string;
  strength: string;
  category: MedicineCategory;
}): string | null {
  const names = m.salt.split("+").map(ingredientName).filter(Boolean);
  const strength = cleanStrength(m.strength);
  if (names.length === 0 || !strength) return null;
  const values = strength.split("+").map((v) => strengthKey(v));
  // Pair each ingredient with its strength so the order doesn't matter
  const parts =
    values.length === names.length
      ? names.map((n, i) => `${n}=${values[i]}`).sort()
      : [...names.sort(), `=${strengthKey(strength)}`];
  return `${m.category}|${parts.join("+")}`;
}

/** Strength to use for matching: the saved one, else the best guess */
export function effectiveStrength(m: {
  name: string;
  salt: string;
  strength?: string;
  category: MedicineCategory;
}): string {
  return m.strength?.trim() ? m.strength : guessStrength(m);
}

/** Composition of a shop medicine (saved strength, else guessed) */
export const medicineComposition = (m: {
  name: string;
  salt: string;
  strength?: string;
  category: MedicineCategory;
}) =>
  compositionKey({
    salt: m.salt,
    strength: effectiveStrength(m),
    category: m.category,
  });

/**
 * Search-box text that finds a composition among the shop's medicines:
 * "Amoxycillin (500mg) + Clavulanic Acid (125mg)" → "Amoxycillin Clavulanic Acid 500 125"
 * (numbers without units, so "Dolo 650 Tablet" saved without a strength
 * is found too).
 */
export function substituteQuery(salt: string, strength = ""): string {
  const c = splitSalt(salt);
  const numbers = (strength || c.strength).match(/\d+(?:\.\d+)?/g) ?? [];
  return [c.salt.replace(/\+/g, " "), ...numbers]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
