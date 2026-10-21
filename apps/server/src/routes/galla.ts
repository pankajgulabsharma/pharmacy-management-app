/**
 * Galla (cash drawer) — open the day, cash in / out, count and close.
 * Anyone who bills may run their galla; reopening a closed day, removing
 * an entry of a closed day and the history are the owner's.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  businessDate,
  CASH_IN_CATEGORIES,
  CASH_OUT_CATEGORIES,
  DATE_RE,
  DIFF_TOLERANCE_PAISE,
} from "@medicare/domain/cash/galla";
import { can } from "@medicare/domain/auth/permissions";
import { RuleError } from "@medicare/domain/lib/errors";
import type { Database } from "../db/client";
import type { LicenseOptions } from "../license/state";
import { parse } from "../shop/schemas";
import { AuthError } from "../auth/guard";
import * as g from "../shop/galla";

const date = z.string().regex(DATE_RE);
const money = z.number().int().min(0).max(1_000_000_00);
const counter = z.string().max(40).optional();

const viewQuery = z.object({ date: date.optional(), counter }).strict();
const openInput = z
  .object({
    date,
    counter,
    openingPaise: money,
    note: z.string().max(120).optional(),
  })
  .strict();
const entryInput = z
  .object({
    date,
    counter,
    kind: z.enum(["in", "out"]),
    category: z.string().min(1).max(40),
    amountPaise: money.refine((n) => n > 0, "Amount must be more than ₹0"),
    note: z.string().max(120).optional(),
  })
  .strict();
const closeInput = z
  .object({
    date,
    counter,
    countedPaise: money,
    keptPaise: money,
    denominations: z.record(z.string().max(10), z.number()).optional(),
    note: z.string().max(200).optional(),
  })
  .strict();
const historyQuery = z.object({ from: date, to: date }).strict();

export function gallaRoutes(
  app: FastifyInstance,
  { raw }: Database,
  license: LicenseOptions,
) {
  /** Staff work on THIS computer's galla; only the owner picks another */
  const pick = (role: string | undefined, counter?: string) =>
    can(role as never, "admin") ? counter : undefined;
  const ownerOnly = (role: string | undefined) => {
    if (!can(role as never, "admin"))
      throw new AuthError("Only the owner can do this", 403);
  };

  /** Today's (or a date's) galla for this counter */
  app.get("/api/galla", async (req) => {
    const q = parse(viewQuery, req.query);
    const day = q.date ?? businessDate();
    return g.gallaView(
      raw,
      license,
      day,
      g.gallaOf(raw, license, req, pick(req.user?.role, q.counter)),
    );
  });

  app.post("/api/galla/open", async (req) => {
    const b = parse(openInput, req.body);
    const c = g.gallaOf(raw, license, req, pick(req.user?.role, b.counter));
    g.openDay(
      raw,
      b.date,
      c,
      b.openingPaise,
      (b.note ?? "").trim(),
      req.user!.name,
    );
    return g.gallaView(raw, license, b.date, c);
  });

  app.post("/api/galla/entries", async (req, reply) => {
    const b = parse(entryInput, req.body);
    const c = g.gallaOf(raw, license, req, pick(req.user?.role, b.counter));
    const known: readonly string[] =
      b.kind === "in" ? CASH_IN_CATEGORIES : CASH_OUT_CATEGORIES;
    if (!known.includes(b.category))
      throw new RuleError("Pick a category from the list");
    if (g.getDay(raw, b.date, c)?.status === "closed")
      throw new RuleError("This day is closed — the owner can reopen it");
    // The drawer can't give out more than it holds
    if (b.kind === "out") {
      const has = g.gallaView(raw, license, b.date, c).summary.expectedPaise;
      if (b.amountPaise > has)
        throw new RuleError(
          has > 0
            ? `The galla should only have ₹${(has / 100).toLocaleString("en-IN")} — check the amount, or the opening cash`
            : "The galla should be empty — start the day with the opening cash first",
        );
    }
    g.addEntry(raw, {
      date: b.date,
      counter: c,
      kind: b.kind,
      category: b.category,
      amountPaise: b.amountPaise,
      note: (b.note ?? "").trim(),
      by: req.user!.name,
      source: "manual",
      ref: "",
    });
    return reply.code(201).send(g.gallaView(raw, license, b.date, c));
  });

  app.delete<{ Params: { id: string } }>(
    "/api/galla/entries/:id",
    async (req) => {
      const row = raw
        .prepare("SELECT date, counter, by FROM cash_entries WHERE id = ?")
        .get(req.params.id) as
        { date: string; counter: string; by: string } | undefined;
      // Staff may undo their own entry of today; anything else is the owner's
      if (row && !(row.by === req.user!.name && row.date === businessDate()))
        ownerOnly(req.user!.role);
      g.removeEntry(raw, req.params.id);
      return g.gallaView(raw, license, row!.date, row!.counter);
    },
  );

  app.post("/api/galla/close", async (req) => {
    const b = parse(closeInput, req.body);
    const c = g.gallaOf(raw, license, req, pick(req.user?.role, b.counter));
    g.closeDay(
      raw,
      license,
      {
        date: b.date,
        counter: c,
        countedPaise: b.countedPaise,
        keptPaise: b.keptPaise,
        denominations: b.denominations ?? {},
        note: (b.note ?? "").trim(),
      },
      req.user!.name,
    );
    return g.gallaView(raw, license, b.date, c);
  });

  app.post<{ Params: { id: string } }>(
    "/api/galla/days/:id/reopen",
    async (req) => {
      ownerOnly(req.user!.role);
      const d = g.reopenDay(raw, req.params.id);
      return g.gallaView(raw, license, d.date, d.counter);
    },
  );

  /** Owner: closed days with their differences (Reports → Galla) */
  app.get("/api/galla/history", async (req) => {
    const q = parse(historyQuery, req.query);
    return {
      days: g.dayHistory(raw, q.from, q.to),
      perCounter: g.perCounter(raw, license),
    };
  });

  /**
   * For the bell: days left open ("close yesterday's galla") and, for the
   * owner, recent closings that came out short.
   */
  app.get("/api/galla/pending", async (req) => {
    const today = businessDate();
    const since = businessDate(new Date(Date.now() - 3 * 86_400_000));
    const short = can(req.user!.role, "admin")
      ? g
          .dayHistory(raw, since, today)
          .filter(
            (d) =>
              d.status === "closed" &&
              (d.countedPaise ?? 0) - (d.expectedPaise ?? 0) <
                -DIFF_TOLERANCE_PAISE,
          )
      : [];
    return { open: g.openDaysBefore(raw, today), short };
  });
}
