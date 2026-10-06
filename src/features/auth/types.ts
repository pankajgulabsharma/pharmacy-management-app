export type Role = "owner" | "pharmacist" | "cashier";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  pharmacist: "Pharmacist",
  cashier: "Cashier",
};

export type User = {
  id: string;
  username: string;
  name: string;
  role: Role;
};

export type Session = {
  user: User;
  /** Epoch ms — the session ends here even if the app stays open */
  expiresAt: number;
};
