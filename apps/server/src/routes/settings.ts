/**
 * Shop settings — one copy for every counter. Anyone signed in reads them
 * (they're printed on every bill); only the owner changes them.
 */
import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { Settings } from "@medicare/domain/settings/types";
import {
  applySettingsChange,
  sanitizeSettings,
} from "@medicare/domain/settings/validation";
import type { Database } from "../db/client";
import { writeTx } from "../db/sync";
import { parse } from "../shop/schemas";

/** Each section is cleaned field-by-field by the shared rules */
const section = z.record(z.string(), z.unknown());
const list = z.array(z.string().max(200)).max(100);
const settingsChange = z
  .object({
    shop: section.optional(),
    billing: section.optional(),
    inventory: section.optional(),
    doctors: list.optional(),
    counters: list.optional(),
  })
  .strict();

export function loadSettings(raw: DatabaseSync): Settings {
  const rows = raw.prepare("SELECT key, value_json FROM settings").all() as {
    key: string;
    value_json: string;
  }[];
  const obj: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      obj[r.key] = JSON.parse(r.value_json);
    } catch {
      /* a broken row falls back to the default */
    }
  }
  return sanitizeSettings(obj);
}

export function settingsRoutes(app: FastifyInstance, { raw }: Database) {
  app.get("/api/settings", async () => ({ settings: loadSettings(raw) }));

  // Saved → "settings changed" goes to every counter (events.ts, by URL)
  app.put("/api/settings", async (req) => {
    const change = parse(settingsChange, req.body) as Partial<Settings>;
    return writeTx(raw, () => {
      const next = applySettingsChange(loadSettings(raw), change);
      const now = new Date().toISOString();
      const save = raw.prepare(
        `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      );
      for (const key of Object.keys(next) as (keyof Settings)[])
        save.run(key, JSON.stringify(next[key]), now);
      return { settings: next };
    });
  });
}
