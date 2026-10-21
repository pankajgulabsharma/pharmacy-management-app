/**
 * Doctors (prescribers). The name is the doctor's key everywhere (bills,
 * commission, the register), always written the same way:
 *
 *   "anita mehta, mbbs"  →  "Dr. Anita Mehta, MBBS"
 *
 * Besides the name the law asks for the prescriber on the Schedule H1 / X
 * register — so a doctor may also carry a registration number (State
 * Medical Council / NMC), the clinic or hospital, and a phone number.
 */
import { cleanText } from "../lib/sanitize";

export type DoctorInfo = {
  /** Medical council registration no., e.g. "MMC 2009/03/1234" */
  regNo: string;
  /** Clinic / hospital (and area) */
  clinic: string;
  phone: string;
};

export const DOCTOR_LIMITS = {
  nameMax: 80,
  regNoMax: 30,
  clinicMax: 80,
  phoneMax: 15,
} as const;

/** Degrees typed in small letters → capitals ("mbbs" → "MBBS") */
const DEGREE =
  /^(mbbs|md|ms|dm|mch|dnb|bams|bhms|bums|bds|mds|dgo|dch|frcs|mrcp|dnb|dpm|do|dvd|dlo)$/i;

const titleWord = (w: string) =>
  w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w;

/**
 * The one way a doctor's name is written: "Dr. " + name (in Title Case
 * when typed in small letters) + ", degrees" as typed (known degrees in
 * capitals). "" when there is no name.
 */
export function doctorName(raw: string): string {
  const s = cleanText(raw, DOCTOR_LIMITS.nameMax + 10);
  if (!s) return "";
  const comma = s.indexOf(",");
  let base = (comma < 0 ? s : s.slice(0, comma)).trim();
  const rest = comma < 0 ? "" : s.slice(comma + 1).trim();
  base = base.replace(/^(dr\.?|doctor)(\s+|\.(?=\S))/i, "").trim();
  if (/^dr\.?$/i.test(base)) base = "";
  if (!base) return "";
  // "rohan desai md" → name "Rohan Desai", degree "MD"
  const words = base.split(" ");
  const tail: string[] = [];
  while (words.length > 1 && DEGREE.test(words[words.length - 1]))
    tail.unshift(words.pop()!.toUpperCase());
  const name = words.map(titleWord).join(" ");
  const degrees = [tail.join(" "), rest]
    .filter(Boolean)
    .join(", ")
    .split(/(\s+|\/|\()/)
    .map((t) => (DEGREE.test(t) ? t.toUpperCase() : t))
    .join("");
  return `Dr. ${name}${degrees ? `, ${degrees}` : ""}`.slice(
    0,
    DOCTOR_LIMITS.nameMax,
  );
}

export const EMPTY_DOCTOR_INFO: DoctorInfo = {
  regNo: "",
  clinic: "",
  phone: "",
};

/** Only doctors still in the list, only known fields, sane lengths */
export function cleanDoctorInfo(
  raw: unknown,
  names: readonly string[],
): Record<string, DoctorInfo> {
  const out: Record<string, DoctorInfo> = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const n of names) {
    const v = r[n];
    if (!v || typeof v !== "object") continue;
    const x = v as Record<string, unknown>;
    const info: DoctorInfo = {
      regNo: cleanText(String(x.regNo ?? ""), DOCTOR_LIMITS.regNoMax),
      clinic: cleanText(String(x.clinic ?? ""), DOCTOR_LIMITS.clinicMax),
      phone: String(x.phone ?? "")
        .replace(/[^\d+\s-]/g, "")
        .trim()
        .slice(0, DOCTOR_LIMITS.phoneMax),
    };
    if (info.regNo || info.clinic || info.phone) out[n] = info;
  }
  return out;
}

/** "Reg. MMC 1234 · City Clinic, Thane" — for the register and pick-list */
export function doctorDetails(info?: DoctorInfo | null): string {
  if (!info) return "";
  return [info.regNo ? `Reg. ${info.regNo}` : "", info.clinic]
    .filter(Boolean)
    .join(" · ");
}
