import { create } from "zustand";
import type {
  UserInput,
  UserRecord,
  UserUpdate,
} from "@medicare/domain/auth/types";
import { apiGet, apiRequest } from "@/lib/api";

/**
 * Settings → Users (owner only). Loaded when the screen opens; after any
 * change the server tells every counter "users changed", so lists and
 * signed-in roles update by themselves.
 */
type UserState = {
  users: UserRecord[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (input: UserInput) => Promise<void>;
  update: (id: string, input: UserUpdate) => Promise<void>;
  resetPassword: (id: string, password: string) => Promise<void>;
};

const path = (id: string) => `/api/users/${encodeURIComponent(id)}`;

export const useUserStore = create<UserState>()((set, get) => {
  /** Put the saved account into the list */
  const put = (user: UserRecord) =>
    set({
      users: get().users.some((u) => u.id === user.id)
        ? get().users.map((u) => (u.id === user.id ? user : u))
        : [...get().users, user],
    });
  return {
    users: [],
    loaded: false,
    load: async () => {
      const r = await apiGet<{ users: UserRecord[] }>("/api/users");
      set({ users: r.users, loaded: true });
    },
    add: async (input) =>
      put(
        (await apiRequest<{ user: UserRecord }>("POST", "/api/users", input))
          .user,
      ),
    update: async (id, input) =>
      put(
        (await apiRequest<{ user: UserRecord }>("PUT", path(id), input)).user,
      ),
    resetPassword: async (id, password) =>
      put(
        (
          await apiRequest<{ user: UserRecord }>(
            "POST",
            `${path(id)}/password`,
            { password },
          )
        ).user,
      ),
  };
});
