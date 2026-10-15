/**
 * Reading customers (with old udhaar) and suppliers (with old dues) from
 * a file another software exported — Marg, Tally, GoFrugal, Busy, Excel.
 * Column names are matched loosely ("Party Name", "Mobile No", "Cl. Bal",
 * "GST No"…). Balances like "1,250.00 Dr" are understood; a "Cr" balance
 * (shop owes the customer / supplier owes the shop) is not carried over —
 * it is reported so the owner can settle it by hand.
 */
import { csvRecords, toCsv } from "../lib/csv";
import { cleanText } from "../lib/sanitize";
import type { CustomerInput } from "../customers/types";

const NAME = [
  "name",
  "party",
  "party name",
  "account",
  "account name",
  "ledger",
  "ledger name",
];
const PHONE = [
  "mobile",
  "mobile no",
  "mobile number",
  "phone",
  "phone no",
  "contact no",
  "contact number",
  "whatsapp",
];
const BALANCE = [
  "balance",
  "opening",
  "opening balance",
  "op balance",
  "outstanding",
  "closing balance",
  "cl bal",
  "cl balance",
  "due",
  "dues",
  "amount",
];

const CUSTOMER_ALIASES = {
  name: [...NAME, "customer", "customer name", "patient", "patient name"],
  phone: PHONE,
  address: ["address", "area", "locality"],
  limit: ["credit limit", "limit", "udhaar limit"],
  balance: [...BALANCE, "receivable", "udhaar", "old udhaar"],
} as const;

const SUPPLIER_ALIASES = {
  name: [
    ...NAME,
    "supplier",
    "supplier name",
    "distributor",
    "vendor",
    "vendor name",
  ],
  gstin: ["gstin", "gst", "gst no", "gstin no", "gst number", "gstin uin"],
  dl: [
    "dl",
    "dl no",
    "dl number",
    "drug licence",
    "drug license",
    "drug licence no",
    "drug license no",
  ],
  contact: ["contact person", "contact"],
  phone: PHONE,
  email: ["email", "e mail", "mail"],
  address: ["address"],
  city: ["city", "station", "place", "town"],
  days: ["credit days", "due days", "days", "credit period"],
  balance: [...BALANCE, "payable", "old dues", "old balance"],
} as const;

/** "1,250.50 Dr" → 125050; "300 Cr" → -30000; "" → 0; junk → null */
export function parseBalance(v: string | undefined): number | null {
  const s = (v ?? "").replace(/[₹,\s]|rs\.?/gi, "").toLowerCase();
  if (!s) return 0;
  const m = /^(-?)(\d+(?:\.\d{1,2})?)(dr|cr)?$/.exec(s);
  if (!m) return null;
  const paise = Math.round(Number(m[2]) * 100);
  return m[1] === "-" || m[3] === "cr" ? -paise : paise;
}

export type ImportProblem = { row: number; name: string; error: string };

export type Parsed<T> = {
  rows: T[];
  /** Rows left out, with why (row = line in the file, header = 1) */
  problems: ImportProblem[];
  /** Total old balance carried over (paise) */
  openingPaise: number;
};

function balanceOf(
  raw: string | undefined,
  row: number,
  name: string,
  problems: ImportProblem[],
): number {
  const b = parseBalance(raw);
  if (b === null) {
    problems.push({
      row,
      name,
      error: `Balance “${raw}” is not a number — taken as 0`,
    });
    return 0;
  }
  if (b < 0) {
    problems.push({
      row,
      name,
      error: "Credit (Cr) balance — not carried over, settle it by hand",
    });
    return 0;
  }
  return b;
}

export function parseCustomerCsv(text: string): Parsed<CustomerInput> {
  const { records, found } = csvRecords(text, CUSTOMER_ALIASES);
  if (!found.includes("name"))
    throw new Error("No “Name” / “Party Name” column found in this file");
  const out: Parsed<CustomerInput> = {
    rows: [],
    problems: [],
    openingPaise: 0,
  };
  records.forEach((r, i) => {
    const row = i + 2;
    const name = cleanText(r.name ?? "", 60);
    if (!name) return; // blank / total lines
    if (/^(grand\s*)?total$/i.test(name)) return;
    const phone = (r.phone ?? "").replace(/\D/g, "").slice(-10);
    const opening = balanceOf(r.balance, row, name, out.problems);
    const limit = parseBalance(r.limit) ?? 0;
    out.rows.push({
      name,
      phone: /^[6-9]\d{9}$/.test(phone) ? phone : "",
      address: cleanText(r.address ?? "", 160),
      creditLimitPaise: Math.max(0, limit),
      openingBalancePaise: opening,
      notes: phone && !/^[6-9]\d{9}$/.test(phone) ? `Phone: ${r.phone}` : "",
      status: "active",
    });
    out.openingPaise += opening;
  });
  return out;
}

export type SupplierImportInput = {
  name: string;
  gstin: string;
  drugLicenseNo: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  creditDays: number;
  openingDuePaise: number;
};

export function parseSupplierCsv(text: string): Parsed<SupplierImportInput> {
  const { records, found } = csvRecords(text, SUPPLIER_ALIASES);
  if (!found.includes("name"))
    throw new Error("No “Name” / “Party Name” column found in this file");
  const out: Parsed<SupplierImportInput> = {
    rows: [],
    problems: [],
    openingPaise: 0,
  };
  records.forEach((r, i) => {
    const row = i + 2;
    const name = cleanText(r.name ?? "", 80);
    if (!name || /^(grand\s*)?total$/i.test(name)) return;
    const days = Number.parseInt(r.days ?? "", 10);
    const due = balanceOf(r.balance, row, name, out.problems);
    out.rows.push({
      name,
      gstin: (r.gstin ?? "").replace(/\s/g, "").toUpperCase(),
      drugLicenseNo: cleanText(r.dl ?? "", 40),
      contactPerson: cleanText(r.contact ?? "", 60),
      phone: (r.phone ?? "").replace(/\D/g, "").slice(-11),
      email: (r.email ?? "").trim().slice(0, 80),
      address: cleanText(r.address ?? "", 200),
      city: cleanText(r.city ?? "", 40),
      creditDays: Number.isFinite(days) ? Math.min(365, Math.max(0, days)) : 30,
      openingDuePaise: due,
    });
    out.openingPaise += due;
  });
  return out;
}

/** Sample files to fill in Excel (or to compare with what the old software exports) */
export const CUSTOMER_SAMPLE_CSV = toCsv(
  [
    ["Ramesh Patil", "9812345670", "Gokhale Road, Thane", "5000", "1250.00"],
    ["Sunita Joshi", "9823456781", "Naupada, Thane", "", "0"],
  ],
  [
    { header: "Name", value: (r) => r[0] },
    { header: "Mobile", value: (r) => r[1] },
    { header: "Address", value: (r) => r[2] },
    { header: "Credit Limit", value: (r) => r[3] },
    { header: "Old Udhaar", value: (r) => r[4] },
  ],
  { bom: true },
);

export const SUPPLIER_SAMPLE_CSV = toCsv(
  [
    [
      "Om Sai Medical Agencies",
      "27AACFO5678L1ZN",
      "MH-TZ3-20B-112233",
      "9820011122",
      "Thane",
      "30",
      "48500.00",
    ],
  ],
  [
    { header: "Name", value: (r) => r[0] },
    { header: "GSTIN", value: (r) => r[1] },
    { header: "DL No", value: (r) => r[2] },
    { header: "Mobile", value: (r) => r[3] },
    { header: "City", value: (r) => r[4] },
    { header: "Credit Days", value: (r) => r[5] },
    { header: "Old Dues", value: (r) => r[6] },
  ],
  { bom: true },
);
