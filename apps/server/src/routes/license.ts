/**
 * Licence: everyone signed in sees the status (the warning banner); only
 * the owner enters a new key. Works even while the software is on hold.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { RuleError } from "@medicare/domain/lib/errors";
import type { Database } from "../db/client";
import { parse } from "../shop/schemas";
import {
  licenseState,
  saveLicenseKey,
  type LicenseOptions,
} from "../license/state";

export function licenseRoutes(
  app: FastifyInstance,
  { raw }: Database,
  o: LicenseOptions,
) {
  app.get("/api/license", async () => licenseState(raw, o));

  app.post("/api/license", async (req) => {
    const { key } = parse(
      z.object({ key: z.string().min(10).max(4000) }).strict(),
      req.body,
    );
    const r = saveLicenseKey(raw, key, o);
    if (!r.ok) throw new RuleError(r.reason);
    return licenseState(raw, o);
  });
}
