/**
 * Doctor referrals & staff commission (owner only — see auth/guard.ts).
 * Rates live in settings ("commission"); only payouts are stored as rows.
 * What is owed is worked out on the screen from the bills.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  cleanRates,
  type CommissionPayout,
} from "@medicare/domain/reports/commission";
import { newId } from "@medicare/domain/lib/id";
import { RuleError } from "@medicare/domain/lib/errors";
import type { Database } from "../db/client";
import { parse } from "../shop/schemas";
import { NotFoundError } from "../shop/errors";

const KEY = "commission";
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ratesInput = z
  .object({
    basis: z.enum(["sales", "profit"]),
    doctors: z.record(z.string().max(80), z.number().min(0).max(100)),
    staff: z.record(z.string().max(80), z.number().min(0).max(100)),
  })
  .strict();
const payoutInput = z
  .object({
    kind: z.enum(["doctor", "staff"]),
    name: z.string().min(1).max(80),
    from: date,
    to: date,
    amountPaise: z.number().int().positive().max(1_000_000_00),
    note: z.string().max(120).optional(),
  })
  .strict();

type Row = {
  id: string;
  kind: "doctor" | "staff";
  name: string;
  from_date: string;
  to_date: string;
  amount_paise: number;
  paid_at: string;
  note: string;
};
const toPayout = (r: Row): CommissionPayout => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  from: r.from_date,
  to: r.to_date,
  amountPaise: r.amount_paise,
  paidAt: r.paid_at,
  note: r.note,
});

export function commissionRoutes(app: FastifyInstance, { raw }: Database) {
  const rates = () => {
    const r = raw
      .prepare("SELECT value_json FROM settings WHERE key = ?")
      .get(KEY) as { value_json: string } | undefined;
    try {
      return cleanRates(r ? JSON.parse(r.value_json) : null);
    } catch {
      return cleanRates(null);
    }
  };
  const payouts = () =>
    (
      raw
        .prepare("SELECT * FROM commission_payouts ORDER BY paid_at DESC")
        .all() as Row[]
    ).map(toPayout);

  app.get("/api/commission", async () => ({
    rates: rates(),
    payouts: payouts(),
  }));

  app.put("/api/commission/rates", async (req) => {
    const next = cleanRates(parse(ratesInput, req.body));
    raw
      .prepare(
        `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      )
      .run(KEY, JSON.stringify(next), new Date().toISOString());
    return { rates: next };
  });

  app.post("/api/commission/payouts", async (req, reply) => {
    const b = parse(payoutInput, req.body);
    if (b.from > b.to) throw new RuleError("“From” must be on or before “To”");
    const p: CommissionPayout = {
      id: newId("cpy"),
      kind: b.kind,
      name: b.name.trim().replace(/\s+/g, " "),
      from: b.from,
      to: b.to,
      amountPaise: b.amountPaise,
      paidAt: new Date().toISOString(),
      note: (b.note ?? "").trim(),
    };
    raw
      .prepare(
        "INSERT INTO commission_payouts (id, kind, name, from_date, to_date, amount_paise, paid_at, note, paid_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        p.id,
        p.kind,
        p.name,
        p.from,
        p.to,
        p.amountPaise,
        p.paidAt,
        p.note,
        req.user?.name ?? "",
      );
    return reply.code(201).send({ payout: p });
  });

  /** A payout entered by mistake */
  app.delete<{ Params: { id: string } }>(
    "/api/commission/payouts/:id",
    async (req) => {
      const r = raw
        .prepare("DELETE FROM commission_payouts WHERE id = ?")
        .run(req.params.id);
      if (!r.changes) throw new NotFoundError("Payout not found");
      return { ok: true };
    },
  );
}
