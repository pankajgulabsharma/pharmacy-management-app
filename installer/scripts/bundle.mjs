/**
 * Puts the app together for Electron:
 *  1. main process + the whole server  → dist/main.js (one file)
 *  2. preload                          → dist/preload.cjs
 *  3. screens (apps/desktop/dist), table updates (apps/server/drizzle) and
 *     the window icon → res/, shipped next to the app by electron-builder
 * Run `npm run build` in the project root first (builds the screens).
 */
import { build } from "esbuild";
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const at = (p) => fileURLToPath(new URL(p, import.meta.url));
const ui = at("../../apps/desktop/dist");
if (!existsSync(`${ui}/index.html`)) {
  console.error(
    "Build the app screens first:  npm run build  (in the project root)",
  );
  process.exit(1);
}

rmSync(at("../dist"), { recursive: true, force: true });
await build({
  entryPoints: [at("../src/main.ts")],
  outfile: at("../dist/main.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  external: ["electron"],
  // Some bundled packages still use require() — give ESM a working one
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  legalComments: "none",
  logLevel: "warning",
});
await build({
  entryPoints: [at("../src/preload.ts")],
  outfile: at("../dist/preload.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  logLevel: "warning",
});

for (const [from, to] of [
  [ui, "../res/app-ui"],
  [at("../../apps/server/drizzle"), "../res/drizzle"],
  [at("../build/icon.png"), "../res/icon.png"],
]) {
  rmSync(at(to), { recursive: true, force: true });
  cpSync(from, at(to), { recursive: true });
}
console.log("Bundled → installer/dist + installer/res");
