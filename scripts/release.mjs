#!/usr/bin/env node
/**
 * New version for all shops:   npm run release            (1.0.3 → 1.0.4)
 *                              npm run release -- 1.2.0   (exact version)
 * Sets the version, commits and tags it. Then push:
 *   git push && git push origin v1.0.4
 * GitHub Actions builds the installer and publishes it; every installed
 * MediCare downloads it by itself and asks to restart.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(new URL("../installer/package.json", import.meta.url));
const pkg = JSON.parse(readFileSync(file, "utf8"));
const asked = process.argv[2];
const [a, b, c] = pkg.version.split(".").map(Number);
const next = asked ?? `${a}.${b}.${c + 1}`;
if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error("Version must look like 1.2.3");
  process.exit(1);
}
const git = (...args) => execFileSync("git", args, { stdio: "inherit" });
if (execFileSync("git", ["status", "--porcelain"]).toString().trim()) {
  console.error("Commit your changes first (git status is not clean).");
  process.exit(1);
}
pkg.version = next;
writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
git("add", file);
git("commit", "-m", `Release v${next}`);
git("tag", `v${next}`);
console.log(`\n✓ v${next} ready. Now:  git push && git push origin v${next}`);
