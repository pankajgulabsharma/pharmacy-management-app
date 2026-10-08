/**
 * Drug schedules (Drugs & Cosmetics Rules, India).
 *   ""  — no prescription needed (OTC)
 *   H   — prescription only ("Rx")
 *   H1  — prescription + entry in the Schedule H1 register (patient, doctor,
 *         medicine, quantity), kept for 3 years
 *   X   — like H1, strictest (separate register; keep prescription copy)
 */
import type { Sale } from "../billing/types";
import { toCsv } from "../lib/csv";
import { inRange, type DateRange } from "../reports/period";

export const DRUG_SCHEDULES = ["", "H", "H1", "X"] as const;
export type DrugSchedule = (typeof DRUG_SCHEDULES)[number];

export const SCHEDULE_LABELS: Record<DrugSchedule, string> = {
  "": "None (OTC)",
  H: "Schedule H (Rx)",
  H1: "Schedule H1 (register)",
  X: "Schedule X (register)",
};

export const isSchedule = (v: unknown): v is DrugSchedule =>
  (DRUG_SCHEDULES as readonly unknown[]).includes(v);
export const needsPrescription = (s?: DrugSchedule) => !!s;
export const needsRegister = (s?: DrugSchedule) => s === "H1" || s === "X";

const WALK_IN = /^walk-?in( customer)?$/i;

/**
 * Can this bill be made? Rx medicines need the prescribing doctor; H1 / X
 * also need the patient's name (both go into the register).
 * Returns the message to show, or null.
 */
export function scheduleRule(
  lines: readonly { medicineName: string; schedule?: DrugSchedule }[],
  customerName: string,
  doctor: string,
): string | null {
  const reg = lines.find((l) => needsRegister(l.schedule));
  if (reg && (!customerName.trim() || WALK_IN.test(customerName.trim())))
    return `${reg.medicineName} is Schedule ${reg.schedule} — enter the patient's name (needed for the register)`;
  const rx = lines.find((l) => needsPrescription(l.schedule));
  if (rx && !doctor.trim())
    return `${rx.medicineName} is Schedule ${rx.schedule} — choose the prescribing doctor`;
  return null;
}

export type RegisterRow = {
  date: string;
  billNo: string;
  patient: string;
  doctor: string;
  medicine: string;
  schedule: DrugSchedule;
  batches: string;
  qty: string;
};

/** The Schedule H1 / X register: every supply, oldest first */
export function scheduleRegister(
  sales: readonly Sale[],
  range: DateRange,
): RegisterRow[] {
  const rows: RegisterRow[] = [];
  for (const s of sales) {
    if (!inRange(s.createdAt, range)) continue;
    for (const l of s.lines) {
      if (!needsRegister(l.schedule)) continue;
      rows.push({
        date: s.createdAt,
        billNo: s.billNo,
        patient: s.customerName,
        doctor: s.doctor,
        medicine: l.medicineName,
        schedule: l.schedule!,
        batches: l.allocations
          .map((a) => `${a.batchNo} (${a.expiry})`)
          .join(", "),
        qty: [
          l.qtyStrip ? `${l.qtyStrip} ${l.unit}` : "",
          l.qtyLoose ? `${l.qtyLoose} loose` : "",
        ]
          .filter(Boolean)
          .join(" + "),
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/** The register as a CSV (to print or keep with the shop's records) */
export const registerCsv = (rows: readonly RegisterRow[]) =>
  toCsv(rows, [
    { header: "Date", value: (r) => new Date(r.date).toLocaleString("en-IN") },
    { header: "Bill no", value: (r) => r.billNo },
    { header: "Patient", value: (r) => r.patient },
    { header: "Prescribing doctor", value: (r) => r.doctor },
    { header: "Medicine", value: (r) => r.medicine },
    { header: "Schedule", value: (r) => r.schedule },
    { header: "Batch (expiry)", value: (r) => r.batches },
    { header: "Quantity", value: (r) => r.qty },
  ]);
