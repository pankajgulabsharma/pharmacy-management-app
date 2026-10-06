# MediCare Pharmacy

Desktop point-of-sale for a medical shop: billing, stock (batch + expiry),
purchases, suppliers, customer udhaar, GST reports.

## Project layout (monorepo — npm workspaces)

```
apps/
  desktop/     The app you see (React + Vite). Everything UI lives here.
  server/      Local server + SQLite database          (coming in Step 3)
packages/
  domain/      Business rules shared by UI and server  (filled in Step 2)
```

**Why this shape?** The same rules (FEFO, GST, stock ledger, udhaar…) must run
in the UI *and* on the server. Keeping them in `packages/domain` means they are
written once and can never disagree.

## Commands (run from the project root)

| Command | What it does |
|---|---|
| `npm install` | Installs everything for all packages (once) |
| `npm run dev` | Starts the desktop app at http://localhost:5173 |
| `npm test` | Runs every test in every package |
| `npm run typecheck` | Type-checks every package |
| `npm run lint` | Lints the whole project |
| `npm run build` | Production build of the desktop app |

Demo login: `admin` / `admin` (owner) or `cashier` / `cashier`.

## Backend roadmap

1. ✅ Monorepo layout (this step) — nothing in the app changes
2. Move business rules into `packages/domain`
3. Server "hello" (Fastify) — `GET /health`
4. Database: SQLite + Drizzle, all tables, demo data
5. First API: medicines & inventory (read)
6. Desktop reads medicines from the server — data survives a refresh
7. Writes with transactions (add/edit medicine, stock adjust)
8. Purchases → Billing → Returns → Udhaar payments
9. Reports from the database
10. Real login, roles
11. Daily backup & restore
12. Desktop installer (Tauri)
13. Several counters on the shop LAN
