# MediCare Pharmacy

Desktop point-of-sale for a medical shop: billing, stock (batch + expiry),
purchases, suppliers, customer udhaar, GST reports.

## Project layout (monorepo — npm workspaces)

```
apps/
  desktop/     The app you see (React + Vite). Everything UI lives here.
  server/      Local server (Fastify) + SQLite database (Drizzle)
packages/
  domain/      Business rules shared by UI and server (pure TypeScript)
  demo/        Demo shop data, built with the real rules
```

**Why this shape?** The same rules (FEFO, GST, stock ledger, udhaar…) must run
in the UI *and* on the server. Keeping them in `packages/domain` means they are
written once and can never disagree.

## Commands (run from the project root)

| Command | What it does |
|---|---|
| `npm install` | Installs everything for all packages (once) |
| `npm run dev` | Starts the desktop app at http://localhost:5173 |
| `npm run dev:server` | Starts the server at http://localhost:4000/health |
| `npm run db:seed` | Fills an empty database with the demo shop (`-- --reset` starts over) |
| `npm run db:studio` | Opens the tables in the browser (https://local.drizzle.studio) |
| `npm test` | Runs every test in every package |
| `npm run typecheck` | Type-checks every package |
| `npm run lint` | Lints the whole project |
| `npm run build` | Production build of the desktop app |

Demo login: `admin` / `admin` (owner) or `cashier` / `cashier`.

## Backend roadmap

1. ✅ Monorepo layout
2. ✅ Business rules in `packages/domain` (app imports them directly)
3. ✅ Server "hello" (Fastify) — `GET /health`, this computer only
4. ✅ Database: SQLite (built into Node) + Drizzle — 19 tables, demo data, DB-level safety rules
5. ✅ First API (read): `/api/medicines`, `/api/medicines/:id`, `/api/inventory/batches`
6. ✅ Desktop reads medicines from the server (header light shows the connection; offline = clear banner + Retry)
7. ✅ Medicines saved to the database (add, edit, delete, CSV import) — checked on the server with Zod + the shared rules
8. Purchases → Billing → Returns → Udhaar payments
9. Reports from the database
10. Real login, roles
11. Daily backup & restore
12. Desktop installer (Tauri)
13. Several counters on the shop LAN

## Where is the data?

`apps/server/data/medicare.sqlite` — one file, never committed to git.
Copy it (with the server stopped) and you have a full backup.
