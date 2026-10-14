import type { Role } from "./types";

/**
 * What each role may CHANGE (and which screens it sees). Everyone signed
 * in may look up stock and prices (billing needs them). The server
 * enforces this; the app hides the screens and buttons.
 *
 *  sell      — bills, held bills, sales returns, customers & udhaar
 *  stock     — medicines and stock adjust
 *  purchases — purchases, debit notes, suppliers & supplier payments
 *  reports   — sales / purchase / GST reports
 *  admin     — shop settings, users, backups, licence (owner only, always)
 *
 * The owner decides what pharmacists and cashiers get (Settings → Users).
 */
export type Permission = "sell" | "stock" | "purchases" | "reports" | "admin";

/** What the owner can give or take away */
export type GrantablePermission = Exclude<Permission, "admin">;
export const GRANTABLE: readonly GrantablePermission[] = [
  "sell",
  "stock",
  "purchases",
  "reports",
];

export const PERMISSION_LABELS: Record<
  GrantablePermission,
  { label: string; help: string }
> = {
  sell: {
    label: "Billing & customers",
    help: "Bills, held bills, sales returns, customers and udhaar",
  },
  stock: {
    label: "Medicines & stock",
    help: "Add / edit medicines, stock adjust, barcode labels",
  },
  purchases: {
    label: "Purchases & suppliers",
    help: "Purchase bills, returns to supplier, supplier payments",
  },
  reports: {
    label: "Reports",
    help: "Sales, profit, GST and stock reports",
  },
};

/** Roles the owner can set up (the owner always has everything) */
export type StaffRole = Exclude<Role, "owner">;
export const STAFF_ROLES: readonly StaffRole[] = ["pharmacist", "cashier"];
export type RoleAccess = Record<StaffRole, GrantablePermission[]>;

export const DEFAULT_ROLE_ACCESS: RoleAccess = {
  pharmacist: ["sell", "stock", "purchases", "reports"],
  cashier: ["sell"],
};

/** Any stored value → valid access (unknown values dropped; missing → default) */
export function cleanRoleAccess(v: unknown): RoleAccess {
  const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const one = (role: StaffRole) =>
    Array.isArray(r[role])
      ? GRANTABLE.filter((p) => (r[role] as unknown[]).includes(p))
      : [...DEFAULT_ROLE_ACCESS[role]];
  return { pharmacist: one("pharmacist"), cashier: one("cashier") };
}

export function can(
  role: Role | null | undefined,
  p: Permission,
  access: RoleAccess = DEFAULT_ROLE_ACCESS,
): boolean {
  if (!role) return false;
  if (role === "owner") return true;
  return p !== "admin" && (access[role] as readonly Permission[]).includes(p);
}
