import type { FastifyInstance } from "fastify";

/** Signs in a demo user (password = username) → headers for app.inject */
export async function signIn(
  app: FastifyInstance,
  username: "admin" | "pharmacist" | "cashier" = "admin",
): Promise<{ authorization: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username, password: username },
  });
  if (res.statusCode !== 200) throw new Error(`sign-in failed: ${res.body}`);
  return { authorization: `Bearer ${res.json().token}` };
}
