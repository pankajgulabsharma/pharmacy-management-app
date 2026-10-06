/**
 * GSTIN (Goods and Services Tax Identification Number) helpers.
 *
 * Format (15 chars): SS PPPPPPPPPP E Z C
 *   SS = state code, P = PAN, E = entity no. (1-9, A-Z), Z = literal "Z",
 *   C  = check character (mod-36 checksum over the first 14 characters).
 * Validating the checksum catches most single-character typos.
 */

const CODE_POINTS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_RE = /^(\d{2})([A-Z]{5}\d{4}[A-Z])([1-9A-Z])Z([0-9A-Z])$/;

export const GST_STATES: Readonly<Record<string, string>> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

/** Check character for the first 14 characters of a GSTIN */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = CODE_POINTS.indexOf(first14[i]);
    if (value < 0) return "";
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CODE_POINTS[(36 - (sum % 36)) % 36];
}

export type GstinCheck =
  | { ok: true; stateCode: string; stateName: string; pan: string }
  | { ok: false; reason: string };

export function checkGstin(raw: string): GstinCheck {
  const value = raw.trim().toUpperCase();
  if (value.length !== 15)
    return { ok: false, reason: "GSTIN must be 15 characters" };
  const m = GSTIN_RE.exec(value);
  if (!m) return { ok: false, reason: "Invalid GSTIN format" };
  const stateName = GST_STATES[m[1]];
  if (!stateName) return { ok: false, reason: "Unknown state code" };
  if (gstinCheckChar(value.slice(0, 14)) !== m[4]) {
    return {
      ok: false,
      reason: "GSTIN check digit doesn't match — please re-check",
    };
  }
  return { ok: true, stateCode: m[1], stateName, pan: m[2] };
}

/** While typing: uppercase letters and digits only, max 15 */
export function toGstinInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 15);
}
