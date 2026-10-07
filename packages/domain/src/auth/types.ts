/** Who can sign in, and what each kind of person may do */
export type Role = "owner" | "pharmacist" | "cashier";

export const ROLES: readonly Role[] = ["owner", "pharmacist", "cashier"];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  pharmacist: "Pharmacist",
  cashier: "Cashier",
};

/** A signed-in person as the app sees them (never the password) */
export type User = {
  id: string;
  username: string;
  name: string;
  role: Role;
  /** First sign-in with a starter password → must pick a new one */
  mustChangePassword: boolean;
};

/** A row in Settings → Users */
export type UserRecord = User & { active: boolean; createdAt: string };

export type UserInput = {
  username: string;
  name: string;
  role: Role;
  password: string;
};
export type UserUpdate = { name: string; role: Role; active: boolean };
