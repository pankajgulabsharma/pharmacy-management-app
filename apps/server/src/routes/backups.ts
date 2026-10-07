/**
 * Backup & restore (owner only — see auth/guard.ts).
 * Download / upload let the owner keep a copy on a pen drive or another PC.
 */
import { createReadStream } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import type { Database } from "../db/client";
import type { EventBus } from "../events";
import {
  KEEP_AUTO,
  checkName,
  createBackup,
  listBackups,
  restoreBackup,
  saveUploadedBackup,
} from "../backup/backup";
import { NotFoundError } from "../shop/errors";

type Params = { Params: { name: string } };
const MAX_UPLOAD = 500 * 1024 * 1024; // 500 MB — years of bills

export function backupRoutes(
  app: FastifyInstance,
  { raw }: Database,
  bus: EventBus,
  dir: string,
) {
  // Backup files arrive as raw bytes
  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer", bodyLimit: MAX_UPLOAD },
    (_req, body, done) => done(null, body),
  );

  app.get("/api/backups", async () => ({
    dir,
    keepAuto: KEEP_AUTO,
    backups: listBackups(dir),
  }));

  app.post("/api/backups", async (_req, reply) =>
    reply.code(201).send({ backup: createBackup(raw, dir, "manual") }),
  );

  app.get<Params>("/api/backups/:name/download", async (req, reply) => {
    const name = checkName(req.params.name);
    if (!listBackups(dir).some((b) => b.name === name))
      throw new NotFoundError("Backup not found");
    return reply
      .header("Content-Type", "application/octet-stream")
      .header("Content-Disposition", `attachment; filename="${name}"`)
      .send(createReadStream(join(dir, name)));
  });

  app.post(
    "/api/backups/upload",
    { bodyLimit: MAX_UPLOAD },
    async (req, reply) => {
      const bytes = req.body;
      if (!Buffer.isBuffer(bytes) || bytes.length === 0)
        return reply.code(400).send({ error: "Choose a backup file" });
      return reply.code(201).send({ backup: saveUploadedBackup(dir, bytes) });
    },
  );

  app.post<Params>("/api/backups/:name/restore", async (req) => {
    const safety = await restoreBackup(raw, dir, req.params.name);
    bus.emit("all"); // every counter reloads everything
    return { safety };
  });
}
