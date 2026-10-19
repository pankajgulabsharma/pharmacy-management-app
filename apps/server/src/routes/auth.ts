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
  PIN_LENGTH,
  USER_LIMITS,
  ownerSetsPin,
  checkPassword,
  checkPin,
  cleanNewUser,
  cleanUserUpdate,
  normalizeUsername,
} from "@medicare/domain/auth/users";
import type { SignInPerson } from "@medicare/domain/auth/types";
import { RuleError } from "@medicare/domain/lib/errors";
import type { Database } from "../db/client";
import { LoginLimiter } from "../auth/limiter";
import { verifyPassword } from "../auth/password";
import * as store from "../auth/store";
import {
  newRecoveryCode,
  recoveryInfo,
  useRecoveryCode,
} from "../auth/recovery";
import { loadSettings } from "./settings";
import { unlockRequest, useUnlockCode } from "../auth/unlock";
import { needsSetup } from "./setup";
import { parse } from "../shop/schemas";
import { licenseState, type LicenseOptions } from "../license/state";
import { NotFoundError } from "../shop/errors";

const password = z.string().max(USER_LIMITS.passwordMax);
const role = z.enum(ROLES as ["owner", "pharmacist", "cashier"]);

const pinField = z.string().max(PIN_LENGTH);
/** Username + password, or a tile on the sign-in screen (id) + PIN / password */
const loginInput = z
  .object({
    username: z.string().max(60).optional(),
    userId: z.string().max(60).optional(),
    password: password.optional(),
    pin: pinField.optional(),
    remember: z.boolean().optional(),
  })
  .strict()
  .refine((b) => (b.username ?? b.userId) !== undefined, "Choose who you are")
  .refine((b) => (b.password ?? b.pin) !== undefined, "Enter the password");
const recoverInput = z
  .object({ userId: z.string().max(60), code: z.string().max(40), password })
  .strict();
const unlockInput = z
  .object({ userId: z.string().max(60), code: z.string().max(200), password })
  .strict();
const pinInput = z.object({ pin: pinField.nullable() }).strict();
const myPinInput = z.object({ password, pin: pinField.nullable() }).strict();
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
  license: LicenseOptions,
  limiter = new LoginLimiter(),
  pinLimiter = new LoginLimiter(5, 60_000),
) {
  /** Who can sign in — the tiles on the sign-in screen (no usernames) */
  app.get("/api/auth/people", async () => {
    const people: SignInPerson[] = store
      .loadUsers(raw)
      .filter((u) => u.active)
      .map((u): SignInPerson => ({
        id: u.id,
        name: u.name,
        role: u.role,
        method: u.hasPin && !u.mustChangePassword ? "pin" : "password",
      }))
      // Owners first, then pharmacists, then cashiers — A to Z
      .sort(
        (a, b) =>
          ROLES.indexOf(a.role) - ROLES.indexOf(b.role) ||
          a.name.localeCompare(b.name),
      );
    return {
      shop: loadSettings(raw).shop.name,
      people,
      // Brand-new shop → the one-screen setup instead of the tiles
      setup: needsSetup(raw),
    };
  });

  app.post("/api/auth/login", async (req, reply) => {
    const body = parse(loginInput, req.body);
    const byPin = body.pin !== undefined;
    const who = body.userId ?? normalizeUsername(body.username ?? "");
    // A PIN is short: wrong tries are counted per person, from any counter
    const lim = byPin ? pinLimiter : limiter;
    const key = byPin ? `pin|${who}` : `${req.ip}|${who}`;
    const tooMany = (sec: number) =>
      reply.code(429).send({
        error: `Too many wrong attempts — try again in ${sec} seconds`,
        retryInSec: sec,
      });
    const wait = lim.lockedFor(key);
    if (wait) return tooMany(wait);
    const found = body.userId
      ? store.findUser(raw, "id", body.userId)
      : store.findUser(raw, "username", who);
    // Always check (even for unknown people) so timing reveals nothing
    const pinAllowed = found && !found.user.mustChangePassword;
    const ok = byPin
      ? await verifyPassword(
          body.pin!,
          pinAllowed ? (found.pinHash ?? undefined) : undefined,
        )
      : await verifyPassword(body.password ?? "", found?.passwordHash);
    if (!found || !ok || !found.user.active) {
      const locked = lim.fail(key);
      return locked
        ? tooMany(locked)
        : reply.code(401).send({
            error: byPin ? "Wrong PIN" : "Wrong username or password",
          });
    }
    limiter.success(key);
    // Licence: how many computers may bill at the same time
    const max = licenseState(raw, license).counters;
    if (max && !store.isLocal(req.ip)) {
      const others = store.activeCounterIps(raw);
      if (!others.has(req.ip) && others.size >= max - 1)
        return reply.code(403).send({
          error: `Your licence allows ${max} computer${max === 1 ? "" : "s"} at a time. Sign out on another counter, or ask your provider to add counters.`,
        });
    }
    const s = store.createSession(
      raw,
      found.user.id,
      body.remember === true && !byPin,
      req.ip,
    );
    return {
      token: s.token,
      expiresAt: s.expiresAt,
      user: store.toUser(found.user),
    };
  });

  /** Owner forgot the password: recovery code → new password */
  app.post("/api/auth/recover", async (req, reply) => {
    const body = parse(recoverInput, req.body);
    const key = `recover|${req.ip}`;
    const wait = limiter.lockedFor(key);
    if (wait)
      return reply.code(429).send({
        error: `Too many wrong attempts — try again in ${wait} seconds`,
        retryInSec: wait,
      });
    const target = store.findUser(raw, "id", body.userId)?.user;
    if (!target || target.role !== "owner" || !target.active)
      throw new RuleError(
        "Only an owner's password can be reset with the code",
      );
    const bad = checkPassword(body.password, target.username);
    if (bad) throw new RuleError(bad);
    if (!(await useRecoveryCode(raw, body.code))) {
      limiter.fail(key);
      return reply.code(400).send({ error: "This recovery code is not right" });
    }
    limiter.success(key);
    await store.setPassword(raw, target.id, body.password, false);
    store.endUserSessions(raw, target.id);
    return { ok: true };
  });

  /** No recovery code either: the provider's unlock code (see auth/unlock.ts) */
  app.get("/api/auth/unlock-request", async () => ({
    machine: license.machine,
    request: unlockRequest(raw),
    shop: loadSettings(raw).shop.name,
  }));

  app.post("/api/auth/unlock", async (req, reply) => {
    const body = parse(unlockInput, req.body);
    const key = `unlock|${req.ip}`;
    const wait = limiter.lockedFor(key);
    if (wait)
      return reply.code(429).send({
        error: `Too many wrong attempts — try again in ${wait} seconds`,
        retryInSec: wait,
      });
    const target = store.findUser(raw, "id", body.userId)?.user;
    if (!target || target.role !== "owner" || !target.active)
      throw new RuleError(
        "Only an owner's password can be reset with the code",
      );
    const bad = checkPassword(body.password, target.username);
    if (bad) throw new RuleError(bad);
    if (!useUnlockCode(raw, body.code, license.publicKey, license.machine)) {
      limiter.fail(key);
      return reply.code(400).send({
        error:
          "This unlock code is not right for this computer (or older than 24 hours)",
      });
    }
    limiter.success(key);
    await store.setPassword(raw, target.id, body.password, false);
    store.endUserSessions(raw, target.id);
    return { ok: true };
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

  /** My own PIN (any role) — needs my password, so an open screen can't change it */
  app.post("/api/auth/pin", async (req) => {
    const body = parse(myPinInput, req.body);
    const me = req.user!;
    const found = store.findUser(raw, "id", me.id)!;
    if (!(await verifyPassword(body.password, found.passwordHash)))
      throw new RuleError("Password is wrong");
    if (body.pin !== null) {
      const bad = checkPin(body.pin);
      if (bad) throw new RuleError(bad);
    }
    await store.setPin(raw, me.id, body.pin);
    return { hasPin: body.pin !== null };
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
    // Became an owner → password only from now on
    // Became an owner → a PIN someone else set is removed (owners set their own)
    if (next.role === "owner" && current.role !== "owner")
      await store.setPin(raw, current.id, null);
    return { user: store.findUser(raw, "id", current.id)!.user };
  });

  /** Counter PIN for a staff member (null = remove) */
  app.post<Params>("/api/users/:id/pin", async (req) => {
    const target = store.findUser(raw, "id", req.params.id)?.user;
    if (!target) throw new NotFoundError("User not found");
    const { pin } = parse(pinInput, req.body);
    if (pin !== null) {
      if (!ownerSetsPin(target.role))
        throw new RuleError("Owners set their own PIN (menu → My PIN)");
      const bad = checkPin(pin);
      if (bad) throw new RuleError(bad);
    }
    await store.setPin(raw, target.id, pin);
    return { user: store.findUser(raw, "id", target.id)!.user };
  });

  /** Owner's recovery code: when it was made / make a new one (shown once) */
  app.get("/api/users/recovery-code", async () => recoveryInfo(raw));
  app.post("/api/users/recovery-code", async () => newRecoveryCode(raw));

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
