/**
 * @medicare/domain — the shop's business rules, in ONE place.
 *
 * Pure TypeScript (no React, no database): stock ledger, FEFO, GST,
 * pricing, sales, returns, udhaar, reports. The desktop UI and the server
 * both import from here, so a rule can never differ between them.
 *
 * Step 1 (this commit) only creates the package. Step 2 moves the rules in.
 */
export const DOMAIN_VERSION = "0.0.0";
