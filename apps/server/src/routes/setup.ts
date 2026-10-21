/**
 * First start of a brand-new shop: ONE screen — shop details + the owner's
 * name and password — and the shop is ready. No "admin / admin" to tell
 * anyone, no forced password change afterwards.
 *
 * Open only while the shop is untouched (one owner still on the starter
 * password, never set up). After that it answers "already set up".
 */
import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { checkPassword, USER_LIMITS } from "@medicare/domain/auth/users";
import { RuleError } from "@medicare/domain/lib/errors";
import { cleanText } from "@medicare/domain/lib/sanitize";
import { applySettingsChange } from "@medicare/domain/settings/validation";
import type { Database } from "../db/client";
import { writeTx } from "../db/sync";
import { parse } from "../shop/schemas";
import * as store from "../auth/store";
import { newRecoveryCode } from "../auth/recovery";
import { loadSettings, saveSettings } from "./settings";
import { recordSignIn } from "../auth/signIns";
import type { LicenseOptions } from "../license/state";

const KEY = "setup_done";

/** Untouched shop: never set up, one owner still on the starter password */
export function needsSetup(raw: DatabaseSync): boolean {
  if (raw.prepare("SELECT 1 FROM settings WHERE key = ?").get(KEY))
    return false;
  const users = store.loadUsers(raw);
  return (
    users.length === 1 &&
    users[0].role === "owner" &&
    users[0].mustChangePassword
  );
}

const text = (max: number) => z.string().max(max);
const setupInput = z
  .object({
    shop: z
      .object({
        name: text(80),
        phone: text(20),
        address: text(200),
        drugLicense: text(80),
        gstin: text(20),
      })
      .strict(),
    owner: z
      .object({ name: text(60), password: text(USER_LIMITS.passwordMax) })
      .strict(),
  })
  .strict();

export function setupRoutes(
  app: FastifyInstance,
  { raw }: Database,
  license: LicenseOptions,
) {
  app.post("/api/setup", async (req, reply) => {
    if (!needsSetup(raw)) throw new RuleError("This shop is already set up");
    const body = parse(setupInput, req.body);
    const owner = store.loadUsers(raw)[0];
    const name = cleanText(body.owner.name, 60);
    if (name.length < 2) throw new RuleError("Enter your name");
    const bad = checkPassword(body.owner.password, owner.username);
    if (bad) throw new RuleError(bad);
    if (body.owner.password.toLowerCase() === "admin")
      throw new RuleError("Choose a password only you know (not “admin”)");

    // Shop details: the same checks as Settings → Shop profile
    const current = loadSettings(raw);
    const next = applySettingsChange(current, {
      shop: { ...current.shop, ...body.shop },
    });
    await store.setPassword(raw, owner.id, body.owner.password, false);
    writeTx(raw, () => {
      saveSettings(raw, next);
      raw.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, owner.id);
      raw
        .prepare(
          "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
        )
        .run(
          KEY,
          JSON.stringify({ at: new Date().toISOString() }),
          new Date().toISOString(),
        );
    });
    // Forgot-password safety from day one; shown once on the next screen
    const recovery = await newRecoveryCode(raw);
    const s = store.createSession(raw, owner.id, false, req.ip);
    recordSignIn(
      raw,
      license,
      req,
      { id: owner.id, name, role: "owner" },
      s.token,
      "setup",
    );
    return reply.code(201).send({
      token: s.token,
      expiresAt: s.expiresAt,
      user: store.toUser(store.findUser(raw, "id", owner.id)!.user),
      recoveryCode: recovery.code,
    });
  });
}
