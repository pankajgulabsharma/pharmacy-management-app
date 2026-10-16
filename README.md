# MediCare Pharmacy

Desktop point-of-sale for an Indian medical shop: billing, stock (batch +
expiry), purchases, suppliers, customer udhaar, GST reports. Works fully
offline on the shop's own computers; nothing in it costs the shop money
every month (no cloud, no SMS gateway, no paid API).

## What's inside (for a shop owner)

| Area                   | What it does                                                                                                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Billing**            | Keyboard-first (F-keys, barcode scanner), up to 10 bills open at once (tabs), FEFO batches, loose tablets, discounts, cash / UPI / card / split / udhaar, hold & resume, sales return, print (thermal / A5 / A4 GST) and WhatsApp bill |
| **Medicine Library**   | ~2.4 lakh Indian medicines (name, company, pack, salt + strength, 2022 MRP) built in and offline — pick one instead of typing; HSN / GST / schedule suggested                                                                          |
| **Substitutes**        | Same salt + same strength + same form only (Dolo 650 ↔ Calpol 650, never Calpol 500 or a syrup); "N substitutes in stock" on an out-of-stock medicine                                                                                  |
| **Stock**              | Batch, expiry, rack, min stock, low / out / expiring alerts, stock adjust with reason, full batch history                                                                                                                              |
| **Purchases**          | Supplier invoices with free qty, discount, GST; **import the distributor's invoice file (CSV)**; dues, payments, debit notes, cancel / edit rules                                                                                      |
| **Customers**          | Udhaar khata with credit limit, old udhaar, payments, statements; **refill reminders** on WhatsApp for regular buyers                                                                                                                  |
| **Reports**            | Sales, purchases, GST (GSTR-1 files, GSTR-3B, GSTR-2B match), stock value, **what to order**, **dead stock**, **profit by medicine / company**, medicines sold day by day, Schedule H1 / X / NDPS register                             |
| **Shop**               | Several counters on the shop network (live updates), roles (owner / pharmacist / cashier, owner decides access), daily backups (+ Google Drive / pen drive), licence keys, free auto-updates, Hindi / English                          |
| **Switching software** | Import medicines + opening stock, customers + old udhaar, suppliers + old dues from Marg / Tally / Excel — and **Undo** a wrong file                                                                                                   |

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
in the UI _and_ on the server. Keeping them in `packages/domain` means they are
written once and can never disagree.

## Commands (run from the project root)

| Command                      | What it does                                                            |
| ---------------------------- | ----------------------------------------------------------------------- |
| `npm install`                | Installs everything for all packages (once)                             |
| `npm run dev`                | Starts the desktop app at http://localhost:5173                         |
| `npm run dev:server`         | Starts the server at http://localhost:4000/health                       |
| `npm run dev:server:license` | Same, but with the licence on (30-day trial) — to try it in development |
| `npm run db:seed`            | Fills an empty database with the demo shop (`-- --reset` starts over)   |
| `npm run db:studio`          | Opens the tables in the browser (https://local.drizzle.studio)          |
| `npm test`                   | Runs every test in every package                                        |
| `npm run typecheck`          | Type-checks every package                                               |
| `npm run lint`               | Lints the whole project                                                 |
| `npm run build`              | Production build of the desktop app                                     |

## Sign-in & roles

The server checks every password (stored only as a slow scrypt hash) and
every action against the person's role — hiding a button is not enough.

| Demo user (password = username) | Role       | May change                                                  |
| ------------------------------- | ---------- | ----------------------------------------------------------- |
| `admin`                         | Owner      | Everything, incl. Settings and Users                        |
| `pharmacist`                    | Pharmacist | Bills, stock, purchases, suppliers, medicines; sees Reports |
| `cashier`                       | Cashier    | Bills, returns, held bills, customers & udhaar              |

A brand-new (empty) database gets one account, `admin` / `admin`, which must
choose a new password at the first sign-in. Add people in Settings → Users.

**Sign-in screen** — a tile per person (no usernames shown). Staff
(pharmacist / cashier) can get a **4-digit PIN** from the owner (Settings →
Users → _Set PIN_; easy ones like 1111 / 1234 are refused): tap the name,
type the PIN, done. Owners always use their password. 5 wrong PINs pause
that person for a minute (from every counter). **Ctrl+L** (or Alt+Q / menu →
_Switch user_) signs out to the tiles. _Sign in with username_ stays as a
fallback. Demo: the cashier's PIN is `2468`.

**Owner forgot the password** (no SMS, no internet): Settings → Users →
_Owner recovery code_ makes a 12-letter code, shown once — write it down and
keep it at home. Sign-in screen → owner's tile → _Forgot password?_ → code +
new password. One use; the bell reminds the owner until a code is made.

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
17. ✅ One search for the whole app (same rules on every screen)
18. ✅ Backups to Google Drive / pen drive (+ licence details), financial-year bill numbers, GST returns (GSTR-1 files, GSTR-2B match, B2B / IGST bills), year close, fast loading after years of bills
19. ✅ Medicine Library (~2.4 lakh medicines, offline search) + bill tabs (10 bills at once)
20. ✅ Owner-defined role access, edit users, trial licence keys of any length
21. ✅ Medicines sold day by day, sales return by day, switching from other software (customers / suppliers with old balances)
22. ✅ Customer-linked bills (mobile for WhatsApp), big lists drawn fast, shop details on screen
23. ✅ Software name vs shop name, Schedule H / H1 / X / NDPS like Marg (patient address on the register)
24. ✅ Low / out counts agree everywhere; customer's saved mobile / address on the bill (edits update the account)
25. ✅ Save a walk-in as a customer from billing; text limits shown
26. ✅ Default udhaar limit for new customers; udhaar due shown on Edit customer
27. ✅ Schedule register draws only visible rows
28. ✅ Medicine strength + substitutes only on salt + strength + form
29. ✅ Undo a medicine import
30. ✅ Screens load on first use (smaller app files)
31. ✅ Undo customer / supplier imports
32. ✅ What to order, dead stock, profit by medicine / company
33. ✅ Refill reminders on WhatsApp
34. ✅ Distributor's invoice file → purchase lines
35. ✅ WhatsApp opens straight in Web / the app; order list goes to the supplier
36. ✅ Backup & data: one-click Google Drive / pen drive, folder browser, missed copies catch up, bell warns
37. ✅ Sign-in tiles + staff PIN, Ctrl+L switch user, owner recovery code

## Windows installer

`MediCare-Pharmacy-Setup-x.y.z.exe` — double-click, Next, Install. No admin
rights, no Node.js, no separate server: the app contains everything.

**Build it** (any of these):

- GitHub → Actions → _Windows installer_ → _Run workflow_ → download the
  `.exe` from the run's Artifacts (works from any computer, even a Mac);
- on a Windows PC: `npm run installer` → `installer/release/`.

On the first start the app asks what this computer is:

| Choice            | What it does                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Main computer** | Keeps the data (`%APPDATA%\MediCare Pharmacy\data`) and the daily backups. Starts empty with one account `admin` / `admin` (must be changed). The installed app never contains demo data (development only: `npm run db:seed`). |
| **Extra counter** | Keeps no data — connects to the main computer's address.                                                                                                                                                                        |

Change it later with **Ctrl+Shift+S** (or Settings → This computer & network).
Uninstalling never deletes the shop's data.

## Several counters (shop network)

1. Main computer: Settings → **This computer & network** → _Share with
   other counters_. Windows may ask once — allow **Private networks**.
   The screen shows the address, e.g. `http://192.168.1.10:4000`.
2. Each other counter: install the same app → _Extra counter_ → type that
   address (or just open it in Chrome / Edge).
3. Every counter signs in with its own user; bills, stock and udhaar are
   the same everywhere and update live. Keep the app open on the main
   computer while the shop is open (closing it asks first).

## Printing & barcodes

- **Bills** print as a clean page in the paper size chosen for each
  computer (Settings → Printing, or _Printer_ on any bill): thermal 80 mm,
  thermal 58 mm, A5, or A4 full GST tax invoice (HSN, batch, expiry, GST
  table, amount in words). Laser, inkjet, thermal and dot-matrix printers
  all work through their Windows driver. The installed app can print
  straight to a chosen printer (no dialog).
- **Barcodes**: most packs already have one — scan it with any USB barcode
  scanner into Billing's search (exact match is added at once). For items
  without one, Medicines → barcode icon → _Create barcode_ makes a shop
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

## Medicine Library & substitutes

- **~2.4 lakh medicines** (A-Z Medicine Dataset of India, CC BY-SA 4.0)
  ship with the app and are searched offline (`apps/server/library/`).
  Typing a medicine the shop doesn't have shows library matches; one click
  fills the Add-medicine form (name, company, pack, salt, strength, MRP of
  2022, suggested HSN / GST / schedule) — the shop checks the pack and saves.
- **Strength** is its own field ("650 mg", "250 mg/5 ml", "500 mg + 125 mg").
  Medicines saved before it are read from the name ("Dolo 650" → 650 mg)
  and the form offers "Use 650 mg?".
- **Substitute = same salt + same strength + same form.** Billing shows
  "N substitutes in stock" on an out-of-stock medicine, and for a medicine
  the shop doesn't keep, which library item has a substitute in stock.

## Schedule H / H1 / X / NDPS

Set the schedule on each medicine (Medicines → edit). Billing then asks
for the prescribing doctor (H, H1, X, NDPS) and the patient's name and
address (H1, X, NDPS); the printed bill marks them `[Sch. H1]`. **Reports → Schedule register** (H1 · X · NDPS) lists every
H1 / X supply (date, bill, patient, doctor, medicine, batch, qty) — export
to keep with the shop's records (3 years).

## Import from old software

Medicines → **Import**: a CSV from Excel, or an export from Marg / Tally /
GoFrugal ("Save as CSV"). Columns are recognised by their usual names
(item name, company, pack, salt / strength, batch, expiry, closing stock,
MRP, P.rate, GST…); one row per batch is fine. Creates the medicines **and**
their opening stock in one go — all rows or none; medicines already in the
list are not duplicated.

Settings → **Coming from other software** also imports **customers** (with
old udhaar) and **suppliers** (with old dues).

**Undo a wrong file**: every import is listed under _Recent imports_ (and
the toast after importing has Undo). Undo removes what the file created —
and the opening stock it added — as long as nothing from it has been used
(sold, purchased, paid, adjusted); otherwise it says which one is in use and
changes nothing.

## Distributor's invoice → purchase

Purchases → New → **Import invoice file**: the CSV the distributor sends
(Marg / Retailio / any software, or Excel → Save as CSV). Item, batch,
expiry, qty, free, rate, MRP, disc %, GST %, invoice no. and date are read;
medicines are matched by barcode or exact name, any other spelling is shown
with a suggestion to accept (never guessed silently). The lines land in the
form — check and save as usual.

## What to order, dead stock, profit

- **Reports → Stock → What to order**: enough for the next 15 / 30 / 45
  days at the speed of the last 30 / 60 / 90 days (all bills, minus customer
  returns), never below the medicine's minimum; stock that expires before it
  would sell isn't counted. Shows the last supplier and the estimated cost;
  **Copy for WhatsApp** pastes the order to the distributor.
- **Reports → Stock → Dead stock**: in stock but not sold for 60 / 90 / 180
  days — the money locked in it, last sale, expiry (return it in time).
- **Reports → Sales → Profit by medicine / company**: sales − landed cost of
  the exact batches sold; sort by lowest margin to see what to renegotiate.

## Refill reminders (free)

A saved customer who bought the same medicine on 2+ bills (BP, sugar,
thyroid…) appears under **Customers → Refills due** a few days before their
usual gap runs out (overdue ones first; the bell shows the count). One
**WhatsApp** per customer lists all their medicines; **Done** hides it until
they buy again. No SMS, no cost.

## WhatsApp (bills, orders, refill reminders) — free

The app opens WhatsApp with the message already typed (shop header,
numbered items, bold total); the shop presses Send. No API, no SMS cost,
**no contact needs to be saved** in the phone.

- Settings → Printing → **WhatsApp (this computer)**: _WhatsApp Web_ (sign in
  once at web.whatsapp.com with the shop phone's QR) or the _WhatsApp
  Desktop app_ (opens the chat straight in the app).
- **Bill**: on a saved bill → WhatsApp → the customer's mobile (filled in for
  a saved customer). Leave it empty to choose the chat in WhatsApp.
- **Order**: Reports → Stock → What to order → **Send on WhatsApp** → pick a
  supplier (only the medicines last bought from them, straight to their
  saved mobile) or the whole list to any chat / group; preview first.
- **Refill reminder**: Customers → Refills due → WhatsApp.
- "This number is not on WhatsApp" means exactly that — the demo shop's
  numbers are made up; use a real mobile that has WhatsApp.

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

| Risk                                                            | Protection                                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Guessing passwords                                              | Slow password hashes (scrypt), 5 wrong tries → 30 s pause, logged                                                               |
| Someone doing what their role doesn't allow                     | Every request checked on the server (not just hidden buttons); refusals logged                                                  |
| Bad / tricky input (incl. SQL injection)                        | Every input checked (Zod, strict); database only through prepared statements                                                    |
| Stolen database file used to sign in                            | Only hashes of passwords and sign-in tokens are stored                                                                          |
| Another website / app talking to the server                     | CORS limited to the app; safety headers + strict Content-Security-Policy                                                        |
| One computer flooding the server                                | Per-computer request limit                                                                                                      |
| Code injected into the installed app (e.g. to skip the licence) | Electron locked down: no Node in pages, sandbox, can't run as Node / with debugger, pages can't navigate away or use camera/mic |
| Staff misuse                                                    | Roles (cashier can't change stock or prices); every bill and return records who made it                                         |
| Data loss                                                       | Daily automatic backups + restore with a safety copy                                                                            |

Honest limits: anyone who can sit at the main computer with its Windows
password can copy the data folder — keep that Windows account password-
protected. On the shop network the traffic is plain HTTP — use the shop's
own Wi-Fi / cable, not a public one. Buying a code-signing certificate
removes Windows' "unknown publisher" warning.

## Where is the data?

`apps/server/data/medicare.sqlite` — one file, never committed to git.

**Backups** — `apps/server/data/backups/`:

- made automatically once a day (the last 30 are kept), and with
  Settings → Backup & data → _Backup now_;
- _Download_ saves a copy (keep one on a pen drive); _Bring a backup file_
  adds one back from a pen drive / another PC;
- _Restore_ puts every counter back to that moment — a safety copy of the
  current data is made first, so a restore can itself be undone.
- zipped (`.sqlite.gz`, ~10× smaller); older `.sqlite` files still work;
- **second copy outside the computer** (free): Settings → Backup & data
  shows what it found on the main computer — Google Drive for desktop,
  OneDrive, Dropbox, pen drives — as one-click cards, or _Other folder…_ to
  browse (no path typing; works from any counter). Every backup is copied
  to `…\MediCare Backups\<shop> (<machine code>)\` with
  `LICENCE-INFO.txt` (shop, computer, machine code, licence key, what to do
  on a new computer). A pen drive that is pulled out is never re-created on
  the computer's own disk; when it is plugged in again the missed copy goes
  out by itself within 2 minutes. A folder on the computer's own disk (or a
  D: partition) is warned about. The owner's bell warns when there is no
  second copy, or none for 3 days;
- **year-end**: the first backup of every financial year is kept for ever.

## Bill numbers

`INV/26-27/0001` — one series per financial year (1 April → 31 March),
starting again at 0001 every 1 April, as GST requires (max 16 characters).
Sales returns `SR/26-27/…`, debit notes `DN/26-27/…`. The prefix can be
changed in Settings → Billing. Older `INV-0816` style numbers simply
continue (`INV/26-27/0817`).

## GST returns (free)

- **B2B bill**: Billing → _+ GSTIN (B2B bill)_. A buyer in another state is
  charged IGST (printed as such).
- **GSTR-3B**: Reports → GST — output vs input tax per slab.
- **GSTR-1**: Reports → GST → _Download GSTR-1 files_ — a zip with b2b,
  b2cs, cdnr, hsn(b2b), hsn(b2c), docs in the GST Offline Tool's CSV format.
  Import them in the free Offline Tool (or give them to the CA), upload the
  JSON it makes. Uploading straight from the app would need a paid GSP —
  not used.
- **GSTR-2B match**: download the GSTR-2B JSON from the portal (free) and
  open it in Reports → GST: every supplier bill is matched with purchases
  (matched / tax differs / not entered / supplier hasn't filed).
- E-invoice (turnover above ₹5 crore) and e-way bills (wholesale) are not
  needed for a retail pharmacy.

## Year close (31 March)

Nothing to run: bill numbers restart by themselves, a year-end backup is
kept, balances and stock carry on. Reports → Stock → _Closing stock on
31 Mar_ gives the year's closing stock (from the stock register).
Reports have _This year (FY)_ / _Last year (FY)_ periods.

## Fast after years of bills

Counters keep only the last 90 days of bills (+ every udhaar bill for khata
balances) and purchase receipts from the stock register. Older bills,
past report periods and a batch's full history are read from the main
computer when a screen needs them — nothing is ever deleted.
