/**
 * This computer's "machine code" — the shop sends it to the provider, who
 * makes a licence key that only works here. Taken from the ID Windows
 * gives each installation (macOS / Linux: their own machine ID), hashed so
 * nothing personal is shown.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { hostname } from "node:os";

function rawMachineId(): string {
  try {
    if (process.platform === "win32") {
      const out = execFileSync(
        "reg",
        [
          "query",
          "HKLM\\SOFTWARE\\Microsoft\\Cryptography",
          "/v",
          "MachineGuid",
        ],
        { encoding: "utf8", windowsHide: true, timeout: 5000 },
      );
      const m = /MachineGuid\s+REG_SZ\s+(\S+)/i.exec(out);
      if (m) return m[1];
    } else if (process.platform === "darwin") {
      const out = execFileSync(
        "ioreg",
        ["-rd1", "-c", "IOPlatformExpertDevice"],
        {
          encoding: "utf8",
          timeout: 5000,
        },
      );
      const m = /"IOPlatformUUID" = "([^"]+)"/.exec(out);
      if (m) return m[1];
    } else {
      return readFileSync("/etc/machine-id", "utf8").trim();
    }
  } catch {
    /* fall back below */
  }
  return `host:${hostname()}`;
}

let cached: string | null = null;

/** e.g. "7KQ2-M9XD-4TRA-PZ6E" (same every time on this computer) */
export function machineCode(): string {
  if (cached) return cached;
  const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I mix-ups
  const h = createHash("sha256").update(`medicare|${rawMachineId()}`).digest();
  let s = "";
  for (let i = 0; i < 16; i++) s += ABC[h[i] % ABC.length];
  cached = s.match(/.{4}/g)!.join("-");
  return cached;
}
