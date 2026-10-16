#!/usr/bin/env node
/**
 * Licence keys for the shops you sell MediCare to — run on YOUR computer.
 *
 *   npm run license -- keygen
 *       Once. Makes your signing key pair: the PRIVATE key goes to
 *       ~/.medicare-vendor/ (keep it secret, back it up — whoever has it can
 *       make licences); the PUBLIC key is written into the app
 *       (apps/server/src/license/public-key.ts). Then build the installer.
 *
 *   npm run license -- issue --shop "Sharma Medicals" --machine 7KQ2-M9XD-4TRA-PZ6E --days 365 --counters 2
 *       Makes a key for one shop. The machine code is shown in the shop's
 *       app (Settings → Licence). --until 2027-03-31 instead of --days.
 *       Every key is also listed in ~/.medicare-vendor/issued.csv.
 *
 *   npm run license -- issue --shop "Gupta Medical" --machine 7KQ2-M9XD-4TRA-PZ6E --trial --months 1.5
 *       A TRIAL of the length you choose (--days 15, --months 1.5 = 45
 *       days, --months 2.5 = 75 days…). Shown as "trial" in the app, no
 *       grace days after it. Later give a normal key — same machine code.
 *
 *   npm run license -- show MC1.xxxx.yyyy
 *       What is inside a key.
 *
 *   npm run license -- unlock --machine 7KQ2-M9XD-4TRA-PZ6E --request 482913
 *       Owner forgot the password AND lost the recovery code: their sign-in
 *       screen (Forgot password? → No code?) shows the machine code and a
 *       request number. This makes the unlock code for exactly that — one
 *       use, 24 hours. Send it on WhatsApp. Listed in unlocks.csv.
 */
import {
  createPrivateKey,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR =
  process.env.MEDICARE_VENDOR_DIR ?? join(homedir(), ".medicare-vendor");
const PRIVATE = join(DIR, "license-private.pem");
const PUBLIC_TS = fileURLToPath(
  new URL("../apps/server/src/license/public-key.ts", import.meta.url),
);

const [cmd, ...rest] = process.argv.slice(2);
const arg = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const ymd = (d) => d.toISOString().slice(0, 10);

if (cmd === "keygen") {
  if (existsSync(PRIVATE) && !rest.includes("--force"))
    fail(
      `A key already exists: ${PRIVATE}\n  (Making a new one makes ALL licences you sold invalid. Use --force only if you really mean it.)`,
    );
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  writeFileSync(PRIVATE, privateKey.export({ type: "pkcs8", format: "pem" }), {
    mode: 0o600,
  });
  const pem = publicKey
    .export({ type: "spki", format: "pem" })
    .toString()
    .trim();
  const src = readFileSync(PUBLIC_TS, "utf8").replace(
    /export const LICENSE_PUBLIC_KEY = [\s\S]*?;\n/,
    `export const LICENSE_PUBLIC_KEY = ${JSON.stringify(pem + "\n")};\n`,
  );
  writeFileSync(PUBLIC_TS, src);
  console.log(
    `✓ Private key: ${PRIVATE}  ← keep secret, keep a backup (pen drive)`,
  );
  console.log(`✓ Public key written into the app: ${PUBLIC_TS}`);
  console.log("  Commit that file, then build the installer.");
} else if (cmd === "issue") {
  if (!existsSync(PRIVATE))
    fail("No signing key yet — run:  npm run license -- keygen");
  const shop = arg("shop")?.trim();
  const machine = arg("machine")?.trim().toUpperCase();
  const counters = Number(arg("counters") ?? 1);
  if (!shop) fail('Give the shop name:  --shop "Sharma Medicals"');
  if (
    !machine ||
    !(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(machine) || machine === "*")
  )
    fail(
      "Give the machine code from the shop's Settings → Licence:  --machine XXXX-XXXX-XXXX-XXXX",
    );
  if (!Number.isInteger(counters) || counters < 1 || counters > 50)
    fail("--counters must be 1–50");
  const today = new Date();
  let until = arg("until");
  const trial = rest.includes("--trial");
  if (!until) {
    const months = arg("months");
    if (months !== undefined && !(Number(months) > 0 && Number(months) <= 120))
      fail("--months must be a number like 1, 1.5 or 2.5");
    const days =
      months !== undefined
        ? Math.round(Number(months) * 30)
        : Number(arg("days") ?? (trial ? 30 : 365));
    if (!Number.isInteger(days) || days < 1)
      fail("--days must be a whole number");
    until = ymd(new Date(today.getTime() + (days - 1) * 86_400_000));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until))
    fail("--until must look like 2027-03-31");
  const data = {
    v: 1,
    id: `LIC-${randomBytes(4).toString("hex").toUpperCase()}`,
    shop,
    machine,
    issuedAt: ymd(today),
    expiresAt: until,
    counters,
    ...(trial ? { trial: true } : {}),
  };
  const body = `MC1.${Buffer.from(JSON.stringify(data)).toString("base64url")}`;
  const sig = sign(
    null,
    Buffer.from(body),
    createPrivateKey(readFileSync(PRIVATE)),
  );
  const key = `${body}.${sig.toString("base64url")}`;
  const csv = join(DIR, "issued.csv");
  if (!existsSync(csv))
    appendFileSync(csv, "licence,shop,machine,issued,expires,counters,key\n");
  appendFileSync(
    csv,
    `${data.id}${trial ? " (trial)" : ""},"${shop.replace(/"/g, '""')}",${machine},${data.issuedAt},${until},${counters},${key}\n`,
  );
  console.log(
    `✓ ${data.id} for ${shop} — ${trial ? "TRIAL " : ""}works until ${until} (end of day), ${counters} computer(s)\n`,
  );
  console.log(key);
  console.log(`\n(Saved in ${csv})`);
} else if (cmd === "unlock") {
  if (!existsSync(PRIVATE))
    fail("No signing key yet — run:  npm run license -- keygen");
  const machine = arg("machine")?.trim().toUpperCase();
  const request = arg("request")?.trim();
  if (!machine || !/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(machine))
    fail(
      "Give the machine code shown on their screen:  --machine XXXX-XXXX-XXXX-XXXX",
    );
  if (!request || !/^\d{6}$/.test(request))
    fail(
      "Give the 6-digit request number shown on their screen:  --request 123456",
    );
  const sig = sign(
    null,
    Buffer.from(`MU1|${machine}|${request}`),
    createPrivateKey(readFileSync(PRIVATE)),
  );
  const code = `MU1.${sig.toString("base64url")}`;
  const csv = join(DIR, "unlocks.csv");
  if (!existsSync(csv)) appendFileSync(csv, "date,machine,request\n");
  appendFileSync(csv, `${new Date().toISOString()},${machine},${request}\n`);
  console.log(
    `✓ Unlock code for ${machine} (request ${request}) — works once, within 24 hours:\n`,
  );
  console.log(code);
} else if (cmd === "show") {
  const key = rest[0] ?? "";
  try {
    console.log(
      JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()),
    );
  } catch {
    fail("That doesn't look like a licence key");
  }
} else {
  console.log(
    readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0],
  );
}
