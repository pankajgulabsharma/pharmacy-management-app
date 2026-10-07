/**
 * Sign-in, sign-out, "who am I", change my password — and the owner's
 * user accounts screen. Passwords never leave the server, not even hashed.
 * (Every change under /api/users tells all counters "users changed", so a
 * new role or a switched-off account takes effect at once — see events.ts.)
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ROLES } from "@medicare/domain/auth/types";
import {
  USER_LIMITS,
  checkPassword,
  cleanNewUser,
  cleanUserUpdate,
  normalizeUsername,
} from "@medicare/domain/auth/users";
import { RuleError } from "@medicare/domain/lib/errors";
import type { Database } from "../db/client";
import { LoginLimiter } from "../auth/limiter";
import { verifyPassword } from "../auth/password";
import * as store from "../auth/store";
import { parse } from "../shop/schemas";
import { NotFoundError } from "../shop/errors";

const password = z.string().max(USER_LIMITS.passwordMax);
const role = z.enum(ROLES as ["owner", "pharmacist", "cashier"]);

const loginInput = z
  .object({
    username: z.string().max(60),
    password,
    remember: z.boolean().optional(),
  })
  .strict();
const changePasswordInput = z
  .object({ current: password, next: password })
  .strict();
const newUserInput = z
  .object({
    username: z.string().max(60),
    name: z.string().max(100),
    role,
    password,
  })
  .strict();
const updateUserInput = z
  .object({ name: z.string().max(100), role, active: z.boolean() })
  .strict();
const resetInput = z.object({ password }).strict();

type Params = { Params: { id: string } };

export function authRoutes(
  app: FastifyInstance,
  { raw }: Database,
  limiter = new LoginLimiter(),
) {
  app.post("/api/auth/login", async (req, reply) => {
    const body = parse(loginInput, req.body);
    const username = normalizeUsername(body.username);
    const key = `${req.ip}|${username}`;
    const wait = limiter.lockedFor(key);
    if (wait)
      return reply.code(429).send({
        error: `Too many wrong attempts — try again in ${wait} seconds`,
        retryInSec: wait,
      });
    const found = store.findUser(raw, "username", username);
    // Always check a password (even for unknown names) so timing reveals nothing
    const ok = await verifyPassword(body.password, found?.passwordHash);
    if (!found || !ok || !found.user.active) {
      const locked = limiter.fail(key);
      return locked
        ? reply.code(429).send({
            error: `Too many wrong attempts — try again in ${locked} seconds`,
            retryInSec: locked,
          })
        : reply.code(401).send({ error: "Wrong username or password" });
    }
    limiter.success(key);
    const s = store.createSession(raw, found.user.id, body.remember === true);
    return {
      token: s.token,
      expiresAt: s.expiresAt,
      user: store.toUser(found.user),
    };
  });

  app.get("/api/auth/me", async (req) => {
    const s = store.resolveSession(raw, req.token)!;
    return { user: store.toUser(s.user), expiresAt: s.expiresAt };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    store.endSession(raw, req.token);
    return reply.code(204).send();
  });

  /** Change my own password (also the forced first-time change) */
  app.post("/api/auth/password", async (req) => {
    const body = parse(changePasswordInput, req.body);
    const me = req.user!;
    const found = store.findUser(raw, "id", me.id)!;
    if (!(await verifyPassword(body.current, found.passwordHash)))
      throw new RuleError("Current password is wrong");
    if (body.next === body.current)
      throw new RuleError("Choose a different password");
    const bad = checkPassword(body.next, me.username);
    if (bad) throw new RuleError(bad);
    await store.setPassword(raw, me.id, body.next, false);
    // Other devices signed in as me are signed out; this one stays
    store.endUserSessions(raw, me.id, req.token);
    return { user: store.toUser(store.findUser(raw, "id", me.id)!.user) };
  });

  /* ---- Owner only (see auth/guard.ts) ---- */

  app.get("/api/users", async () => ({ users: store.loadUsers(raw) }));

  app.post("/api/users", async (req, reply) => {
    const input = cleanNewUser(
      parse(newUserInput, req.body),
      store.loadUsers(raw),
    );
    // New people sign in with the password the owner gave, then choose their own
    const user = await store.createUser(raw, input, {
      mustChangePassword: true,
    });
    return reply.code(201).send({ user });
  });

  app.put<Params>("/api/users/:id", async (req) => {
    const current = store.findUser(raw, "id", req.params.id)?.user;
    if (!current) throw new NotFoundError("User not found");
    const next = cleanUserUpdate(
      current,
      parse(updateUserInput, req.body),
      store.loadUsers(raw),
      req.user!.id,
    );
    raw
      .prepare("UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?")
      .run(next.name, next.role, next.active ? 1 : 0, current.id);
    if (!next.active) store.endUserSessions(raw, current.id);
    return { user: store.findUser(raw, "id", current.id)!.user };
  });

  /** Forgot password: the owner sets a temporary one; the person must change it */
  app.post<Params>("/api/users/:id/password", async (req) => {
    const target = store.findUser(raw, "id", req.params.id)?.user;
    if (!target) throw new NotFoundError("User not found");
    if (target.id === req.user!.id)
      throw new RuleError("Use “Change password” for your own account");
    const { password: temp } = parse(resetInput, req.body);
    const bad = checkPassword(temp, target.username);
    if (bad) throw new RuleError(bad);
    await store.setPassword(raw, target.id, temp, true);
    store.endUserSessions(raw, target.id);
    return { user: store.findUser(raw, "id", target.id)!.user };
  });
}
