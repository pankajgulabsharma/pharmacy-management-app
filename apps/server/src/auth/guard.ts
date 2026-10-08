/**
 * Every /api call (except sign-in) needs a signed-in user, and changing
 * something needs the right role. The rules live HERE, in one table —
 * a new route that isn't listed is owner-only until someone decides.
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { can, type Permission } from "@medicare/domain/auth/permissions";
import type { UserRecord } from "@medicare/domain/auth/types";
import { resolveSession } from "./store";
import { licenseState, type LicenseOptions } from "../license/state";

declare module "fastify" {
  interface FastifyRequest {
    user: UserRecord | null;
    token: string;
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: 401 | 402 | 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

const WRITE_RULES: [RegExp, Permission][] = [
  [
    /^\/api\/(sales|sale-returns|held|customers|customer-payments)(\/|$)/,
    "sell",
  ],
  [
    /^\/api\/(medicines|suppliers|purchases|purchase-returns|stock)(\/|$)/,
    "stock",
  ],
  [/^\/api\/(settings|users|backups|license)(\/|$)/, "admin"],
];

/** null = any signed-in user */
export function requiredPermission(
  method: string,
  path: string,
): Permission | null {
  if (path.startsWith("/api/auth/")) return null;
  if (method === "GET")
    return /^\/api\/(users|backups|audit)(\/|$)/.test(path) ? "admin" : null;
  return WRITE_RULES.find(([re]) => re.test(path))?.[1] ?? "admin";
}

function tokenOf(req: FastifyRequest, path: string): string {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7).trim();
  // The live stream (EventSource) can't send headers — token in the URL
  if (path === "/api/events")
    return String((req.query as { token?: unknown })?.token ?? "");
  return "";
}

/** While on hold (licence), these still work: sign-in, licence, backups, network */
const ON_HOLD_ALLOWED = /^\/api\/(auth|license|backups|system)(\/|$)/;

export function authGuard(
  app: FastifyInstance,
  raw: DatabaseSync,
  license: LicenseOptions,
) {
  app.decorateRequest("user", null);
  app.decorateRequest("token", "");
  app.addHook("preHandler", async (req) => {
    const path = req.url.split("?")[0];
    if (!path.startsWith("/api/") || path === "/api/auth/login") return;
    const token = tokenOf(req, path);
    const session = resolveSession(raw, token);
    if (!session) throw new AuthError("Please sign in again", 401);
    req.user = session.user;
    req.token = token;
    // Starter password: only "change my password" (and sign-out) until it's done
    if (session.user.mustChangePassword && !path.startsWith("/api/auth/"))
      throw new AuthError("Please choose a new password first", 403);
    const need = requiredPermission(req.method, path);
    if (need && !can(session.user.role, need))
      throw new AuthError("Your role can't do this — ask the owner", 403);
    // Licence on hold → look, report, back up — but no new bills / changes
    if (req.method !== "GET" && !ON_HOLD_ALLOWED.test(path)) {
      const state = licenseState(raw, license);
      if (!state.canWork) throw new AuthError(state.message, 402);
    }
  });
}
