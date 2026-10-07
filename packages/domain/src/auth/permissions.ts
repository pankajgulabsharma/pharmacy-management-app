import type { Role } from "./types";

/**
 * What each role may CHANGE. Everyone signed in may look (billing needs
 * stock and prices). The server enforces this; the app only hides buttons.
 *
 *  sell    — bills, held bills, sales returns, customers & udhaar payments
 *  stock   — purchases, debit notes, supplier payments, stock adjust,
 *            medicines & suppliers
 *  reports — sales / purchase / GST reports
 *  admin   — shop settings and user accounts
 */
export type Permission = "sell" | "stock" | "reports" | "admin";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: ["sell", "stock", "reports", "admin"],
  pharmacist: ["sell", "stock", "reports"],
  cashier: ["sell"],
};

export function can(role: Role | null | undefined, p: Permission): boolean {
  return !!role && ROLE_PERMISSIONS[role].includes(p);
}
