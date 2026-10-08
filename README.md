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

## Sign-in & roles

The server checks every password (stored only as a slow scrypt hash) and
every action against the person's role — hiding a button is not enough.

| Demo user (password = username) | Role | May change |
|---|---|---|
| `admin` | Owner | Everything, incl. Settings and Users |
| `pharmacist` | Pharmacist | Bills, stock, purchases, suppliers, medicines; sees Reports |
| `cashier` | Cashier | Bills, returns, held bills, customers & udhaar |

A brand-new (empty) database gets one account, `admin` / `admin`, which must
choose a new password at the first sign-in. Add people in Settings → Users.

## Backend roadmap

1. ✅ Monorepo layout
2. ✅ Business rules in `packages/domain` (app imports them directly)
3. ✅ Server "hello" (Fastify) — `GET /health`, this computer only
4. ✅ Database: SQLite (built into Node) + Drizzle — 20 tables, demo data, DB-level safety rules
5. ✅ First API (read): `/api/medicines`, `/api/medicines/:id`, `/api/inventory/batches`
6. ✅ Desktop reads medicines from the server (header light shows the connection; offline = clear banner + Retry)
7. ✅ Medicines saved to the database (add, edit, delete, CSV import) — checked on the server with Zod + the shared rules
8. ✅ Live updates (no refresh, auto-reconnect) + Suppliers tab on the database
9. ✅ Stock core: Inventory + Purchases + Billing + Returns + Udhaar (one ledger, moved together)
10. ✅ Real sign-in, roles & users; Settings on the database (one copy for every counter); Reports from database data
11. ✅ Daily backup & restore; bell (alerts) & header search; bills show counter + staff; tabs keep their work
12. ✅ Windows installer (Electron: the server runs inside the app — nothing else to install)
13. ✅ Several counters on the shop network (main computer + extra counters) + final checks
14. ✅ Printing for every printer (thermal 58/80 mm, A5, A4 GST invoice) + barcodes & labels
15. ✅ Licences for every shop (trial → key → on hold), security hardening
16. ✅ Free auto-updates, Schedule H / H1 / X (register), import from old software (Marg / Tally / Excel), bill on WhatsApp

## Windows installer

`MediCare-Pharmacy-Setup-x.y.z.exe` — double-click, Next, Install. No admin
rights, no Node.js, no separate server: the app contains everything.

**Build it** (any of these):
- GitHub → Actions → *Windows installer* → *Run workflow* → download the
  `.exe` from the run's Artifacts (works from any computer, even a Mac);
- on a Windows PC: `npm run installer` → `installer/release/`.

On the first start the app asks what this computer is:

| Choice | What it does |
|---|---|
| **Main computer** | Keeps the data (`%APPDATA%\MediCare Pharmacy\data`) and the daily backups. Starts empty with one account `admin` / `admin` (must be changed), or with the demo shop if you tick it. |
| **Extra counter** | Keeps no data — connects to the main computer's address. |

Change it later with **Ctrl+Shift+S** (or Settings → This computer & network).
Uninstalling never deletes the shop's data.

## Several counters (shop network)

1. Main computer: Settings → **This computer & network** → *Share with
   other counters*. Windows may ask once — allow **Private networks**.
   The screen shows the address, e.g. `http://192.168.1.10:4000`.
2. Each other counter: install the same app → *Extra counter* → type that
   address (or just open it in Chrome / Edge).
3. Every counter signs in with its own user; bills, stock and udhaar are
   the same everywhere and update live. Keep the app open on the main
   computer while the shop is open (closing it asks first).

## Printing & barcodes

- **Bills** print as a clean page in the paper size chosen for each
  computer (Settings → Printing, or *Printer* on any bill): thermal 80 mm,
  thermal 58 mm, A5, or A4 full GST tax invoice (HSN, batch, expiry, GST
  table, amount in words). Laser, inkjet, thermal and dot-matrix printers
  all work through their Windows driver. The installed app can print
  straight to a chosen printer (no dialog).
- **Barcodes**: most packs already have one — scan it with any USB barcode
  scanner into Billing's search (exact match is added at once). For items
  without one, Medicines → barcode icon → *Create barcode* makes a shop
  code (EAN-13 starting with 2) and prints stickers on a label printer
  (50×25, 38×25, 50×30 mm) or A4 sticker sheets (65 / 24 per sheet).

## Updates for every shop (free)

```bash
npm run release          # 1.0.3 → 1.0.4: sets the version, commits, tags
git push && git push origin v1.0.4
```
GitHub Actions builds the installer and publishes it as a GitHub Release.
Every installed MediCare checks every 6 hours, downloads it quietly and
asks "Restart now / Later" (data is never touched). Extra counters that
open the main computer's address get new screens as soon as the main
computer updates. Settings → This computer shows the version.

For a **private** code repository: create a free **public** repository
just for installers (e.g. `medicare-releases`), set the repository
variable `UPDATE_REPO` = `you/medicare-releases` and a secret
`RELEASES_TOKEN` (a GitHub token allowed to write to it).

## Schedule H / H1 / X

Set the schedule on each medicine (Medicines → edit). Billing then asks
for the prescribing doctor (H, H1, X) and the patient's name (H1, X); the
printed bill marks them `[Sch. H1]`. **Reports → H1 register** lists every
H1 / X supply (date, bill, patient, doctor, medicine, batch, qty) — export
to keep with the shop's records (3 years).

## Import from old software

Medicines → **Import**: a CSV from Excel, or an export from Marg / Tally /
GoFrugal ("Save as CSV"). Columns are recognised by their usual names
(item name, company, pack, batch, expiry, closing stock, MRP, P.rate, GST…);
one row per batch is fine. Creates the medicines **and** their opening
stock in one go — all rows or none; medicines already in the list are not
duplicated.

## Bill on WhatsApp

On a saved bill (or any bill found with Ctrl+K) → **WhatsApp** → mobile
number → WhatsApp opens with the bill typed out; press Send. Free — no
SMS gateway or API (SMS would need a paid gateway).

## Licences (selling to many shops)

Every shop needs a licence key. New installs get a **30-day trial**. When a
licence ends there are **7 grace days**, then the shop goes **on hold**: no
new bills, purchases or changes — but viewing, reports, backups and entering
a new key always work (the shop's data is never locked away). Moving the
computer's date back also puts it on hold.

You (the provider) make the keys on **your** computer:

```bash
npm run license -- keygen          # ONCE: makes your secret signing key
                                   # (~/.medicare-vendor/ — back it up!) and
                                   # writes the public key into the app → commit it
npm run license -- issue --shop "Sharma Medicals" --machine 7KQ2-M9XD-4TRA-PZ6E --days 365 --counters 2
npm run license -- show MC1.xxxx   # what is inside a key
```

- The **machine code** is shown in the shop's app: Settings → Licence. A key
  only works on that computer (the main computer).
- `--counters` = how many computers may bill at the same time.
- Every key you make is listed in `~/.medicare-vendor/issued.csv`.
- Keys are signed (Ed25519): they can't be edited or made up without your
  private key. **Never** share or commit `license-private.pem`; if you lose
  it you can't renew anyone (making a new one invalidates all old keys).
- The installer can't be built until `keygen` has been run.

## Security

What protects the shop:

| Risk | Protection |
|---|---|
| Guessing passwords | Slow password hashes (scrypt), 5 wrong tries → 30 s pause, logged |
| Someone doing what their role doesn't allow | Every request checked on the server (not just hidden buttons); refusals logged |
| Bad / tricky input (incl. SQL injection) | Every input checked (Zod, strict); database only through prepared statements |
| Stolen database file used to sign in | Only hashes of passwords and sign-in tokens are stored |
| Another website / app talking to the server | CORS limited to the app; safety headers + strict Content-Security-Policy |
| One computer flooding the server | Per-computer request limit |
| Code injected into the installed app (e.g. to skip the licence) | Electron locked down: no Node in pages, sandbox, can't run as Node / with debugger, pages can't navigate away or use camera/mic |
| Staff misuse | Roles (cashier can't change stock or prices); every bill and return records who made it |
| Data loss | Daily automatic backups + restore with a safety copy |

Honest limits: anyone who can sit at the main computer with its Windows
password can copy the data folder — keep that Windows account password-
protected. On the shop network the traffic is plain HTTP — use the shop's
own Wi-Fi / cable, not a public one. Buying a code-signing certificate
removes Windows' "unknown publisher" warning.

## Where is the data?

`apps/server/data/medicare.sqlite` — one file, never committed to git.

**Backups** — `apps/server/data/backups/`:
- made automatically once a day (the last 30 are kept), and with
  Settings → Backup & restore → *Backup now*;
- *Download* saves a copy (keep one on a pen drive); *Bring a backup file*
  adds one back from a pen drive / another PC;
- *Restore* puts every counter back to that moment — a safety copy of the
  current data is made first, so a restore can itself be undone.
