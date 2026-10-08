/**
 * Activity log — who did what, when, from which computer. Every change
 * made through the app is written here automatically (one place: the hook
 * below), plus sign-ins and wrong passwords. The app only ever ADDS rows;
 * the owner reads them in Settings → Activity log.
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { DatabaseSync } from "node:sqlite";

export type AuditEntry = {
  id: number;
  at: string;
  userName: string;
  action: string;
  detail: string;
  ip: string;
};

/** Keep the newest this many rows (years of a busy shop) */
const KEEP = 200_000;

export function audit(
  raw: DatabaseSync,
  e: { userName?: string; action: string; detail?: string; ip?: string },
  now = new Date(),
) {
  const r = raw
    .prepare(
      "INSERT INTO audit_log (at, user_name, action, detail, ip) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      now.toISOString(),
      e.userName ?? "",
      e.action,
      (e.detail ?? "").slice(0, 300),
      e.ip ?? "",
    );
  const id = Number(r.lastInsertRowid);
  if (id % 1000 === 0)
    raw.prepare("DELETE FROM audit_log WHERE id <= ?").run(id - KEEP);
}

export function loadAudit(
  raw: DatabaseSync,
  {
    q = "",
    before = 0,
    limit = 200,
  }: { q?: string; before?: number; limit?: number },
): { entries: AuditEntry[]; more: boolean } {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (before > 0) {
    where.push("id < ?");
    params.push(before);
  }
  const text = q.trim().toLowerCase();
  if (text) {
    where.push(
      "lower(user_name || ' ' || action || ' ' || detail || ' ' || ip) LIKE ?",
    );
    params.push(`%${text.replace(/[%_]/g, "")}%`);
  }
  const rows = raw
    .prepare(
      `SELECT id, at, user_name AS userName, action, detail, ip FROM audit_log
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ?`,
    )
    .all(...params, limit + 1) as AuditEntry[];
  return { entries: rows.slice(0, limit), more: rows.length > limit };
}

/** What each change is called in the log */
const ACTIONS: [method: string, path: RegExp, label: string][] = [
  ["POST", /^\/api\/sales$/, "Bill saved"],
  ["POST", /^\/api\/sale-returns$/, "Sales return"],
  ["POST", /^\/api\/held$/, "Bill put on hold"],
  ["DELETE", /^\/api\/held\//, "Held bill removed / resumed"],
  ["POST", /^\/api\/purchases$/, "Purchase added"],
  ["PUT", /^\/api\/purchases\/[^/]+$/, "Purchase edited"],
  ["POST", /^\/api\/purchases\/[^/]+\/cancel$/, "Purchase cancelled"],
  ["POST", /^\/api\/purchases\/[^/]+\/payments$/, "Supplier paid"],
  ["POST", /^\/api\/purchase-returns$/, "Debit note (return to supplier)"],
  ["POST", /^\/api\/stock\/adjust$/, "Stock adjusted"],
  ["POST", /^\/api\/medicines\/import$/, "Medicines imported"],
  ["POST", /^\/api\/medicines$/, "Medicine added"],
  ["PUT", /^\/api\/medicines\//, "Medicine changed"],
  ["DELETE", /^\/api\/medicines\//, "Medicine deleted"],
  ["POST", /^\/api\/suppliers$/, "Supplier added"],
  ["PUT", /^\/api\/suppliers\//, "Supplier changed"],
  ["DELETE", /^\/api\/suppliers\//, "Supplier deleted"],
  ["POST", /^\/api\/customers$/, "Customer added"],
  ["PUT", /^\/api\/customers\//, "Customer changed"],
  ["POST", /^\/api\/customer-payments$/, "Udhaar payment received"],
  ["PUT", /^\/api\/settings$/, "Shop settings changed"],
  ["POST", /^\/api\/users$/, "User added"],
  ["PUT", /^\/api\/users\//, "User changed"],
  ["POST", /^\/api\/users\/[^/]+\/password$/, "User's password reset"],
  ["POST", /^\/api\/backups$/, "Backup made"],
  ["POST", /^\/api\/backups\/upload$/, "Backup file brought in"],
  ["POST", /^\/api\/backups\/[^/]+\/restore$/, "BACKUP RESTORED"],
  ["POST", /^\/api\/license$/, "Licence key entered"],
  ["POST", /^\/api\/system\/lan$/, "Shop-network sharing switched"],
  ["POST", /^\/api\/auth\/password$/, "Own password changed"],
  ["POST", /^\/api\/auth\/logout$/, "Signed out"],
];

const labelFor = (method: string, path: string) =>
  ACTIONS.find(([m, re]) => m === method && re.test(path))?.[2] ??
  `${method} ${path}`;

const rupees = (p: unknown) =>
  typeof p === "number" ? ` · ₹${(p / 100).toFixed(2)}` : "";

/** A short, readable "what" from the answer / the request */
function detailOf(req: FastifyRequest, payload: unknown): string {
  let r: Record<string, any> = {};
  try {
    r = typeof payload === "string" ? JSON.parse(payload) : {};
  } catch {
    /* not JSON */
  }
  const b = (req.body ?? {}) as Record<string, any>;
  if (r.sale)
    return `${r.sale.billNo} · ${r.sale.customerName}${rupees(r.sale.totals?.netPaise)}`;
  if (r.ret?.returnNo)
    return `${r.ret.returnNo}${r.ret.billNo ? ` (bill ${r.ret.billNo})` : ""}${rupees(r.ret.refundPaise ?? r.ret.totalPaise)}`;
  if (r.purchase)
    return `${r.purchase.invoiceNo} · ${r.purchase.supplierName}${rupees(r.purchase.totals?.netPaise)}`;
  if (r.payment?.receiptNo)
    return `${r.payment.receiptNo}${rupees(r.payment.amountPaise)}`;
  if (r.user?.username)
    return `${r.user.name} (${r.user.username}) · ${r.user.role}${r.user.active === false ? " · switched off" : ""}`;
  if (r.backup?.name) return r.backup.name;
  if (r.safety?.name)
    return `${req.url.split("/")[3]} (safety copy ${r.safety.name})`;
  if (typeof r.name === "string") return r.name;
  if (r.customer?.name) return r.customer.name;
  if (b.reason && b.batchId) {
    const batch = r.patch?.batches?.[0]?.batchNo ?? b.batchId;
    return `Batch ${batch} · ${b.reason} · now ${b.qtyStrip ?? 0} + ${b.qtyLoose ?? 0} loose`;
  }
  if (typeof b.name === "string") return b.name;
  if (typeof b.enabled === "boolean") return b.enabled ? "on" : "off";
  if (r.status) return String(r.status);
  if (Array.isArray(b)) return `${b.length} rows`;
  if (Array.isArray(r.items)) return `${r.items.length} rows`;
  // e.g. DELETE /api/medicines/m12 → "m12"
  return decodeURIComponent(req.url.split("?")[0].split("/")[3] ?? "");
}

/** One hook writes the log for every change — routes don't need to remember */
export function auditHook(app: FastifyInstance, raw: DatabaseSync) {
  app.addHook("onSend", async (req, reply, payload) => {
    const path = req.url.split("?")[0];
    if (
      req.method === "GET" ||
      req.method === "OPTIONS" ||
      !path.startsWith("/api/")
    )
      return payload;
    const status = reply.statusCode;
    try {
      if (path === "/api/auth/login") {
        const username = String(
          (req.body as { username?: unknown })?.username ?? "",
        ).slice(0, 60);
        if (status === 200) {
          const name = JSON.parse(String(payload)).user?.name ?? username;
          audit(raw, { userName: name, action: "Signed in", ip: req.ip });
        } else if (status === 401 || status === 429)
          audit(raw, {
            userName: username,
            action:
              status === 429
                ? "Sign-in paused (too many wrong passwords)"
                : "Wrong password",
            ip: req.ip,
          });
        return payload;
      }
      const label = labelFor(req.method, path);
      if (status < 300)
        audit(raw, {
          userName: req.user?.name,
          action: label,
          detail: detailOf(req, payload),
          ip: req.ip,
        });
      else if (status === 402 && req.user)
        audit(raw, {
          userName: req.user.name,
          action: `Refused (licence on hold): ${label}`,
          ip: req.ip,
        });
      else if (status === 403 && req.user)
        audit(raw, {
          userName: req.user.name,
          action: `Refused: ${label}`,
          detail: "role not allowed",
          ip: req.ip,
        });
    } catch (err) {
      console.error("Activity log:", (err as Error).message);
    }
    return payload;
  });
}
