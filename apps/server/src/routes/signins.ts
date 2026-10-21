/**
 * Sign-in history (owner; Multi-counter plan) — ?from=&to= local dates.
 * "Signed in now" only while that session's app is actually open.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DATE_RE, dayRange } from "@medicare/domain/cash/galla";
import type { Database } from "../db/client";
import type { LicenseOptions } from "../license/state";
import { parse } from "../shop/schemas";
import { listSignIns, signInLogOn } from "../auth/signIns";

const query = z
  .object({ from: z.string().regex(DATE_RE), to: z.string().regex(DATE_RE) })
  .strict();

export function signInRoutes(
  app: FastifyInstance,
  { raw }: Database,
  license: LicenseOptions,
  liveSessions: () => Set<string> = () => new Set(),
) {
  app.get("/api/signins", async (req) => {
    const q = parse(query, req.query);
    if (!signInLogOn(raw, license)) return { enabled: false, items: [] };
    const [from] = dayRange(q.from);
    const [, to] = dayRange(q.to);
    const live = liveSessions();
    return {
      enabled: true,
      items: listSignIns(raw, from, to).map(({ sessionHash, ...r }) => ({
        ...r,
        appOpen: r.signedOutAt === null && live.has(sessionHash),
      })),
    };
  });
}
