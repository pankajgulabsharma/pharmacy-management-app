/**
 * "Find main computer" — a new counter finds the main computer on the
 * shop network by itself, so nobody types an IP address.
 *
 * The main computer (only while sharing is on) answers a small UDP
 * broadcast on port 41234 with its shop name and address. A counter asks
 * every network it is on and lists who answered within ~1.5 seconds.
 * Nothing leaves the shop network; no internet involved.
 */
import { createSocket, type Socket } from "node:dgram";
import { networkInterfaces } from "node:os";

export const DISCOVERY_PORT = 41234;
const ASK = "MEDICARE_FIND_V1";

export type FoundComputer = { url: string; shop: string };

/** Main computer: answer "who is the MediCare main computer?" */
export function startDiscovery(opts: {
  httpPort: number;
  shopName: () => string;
  port?: number;
  log?: (msg: string) => void;
}): Promise<() => void> {
  const sock = createSocket({ type: "udp4", reuseAddr: true });
  sock.on("message", (msg, from) => {
    if (msg.toString() !== ASK) return;
    const reply = JSON.stringify({
      service: "medicare-server",
      shop: opts.shopName(),
      port: opts.httpPort,
    });
    sock.send(reply, from.port, from.address);
  });
  return new Promise((resolve) => {
    sock.once("error", (err) => {
      // Port taken / blocked: counters can still type the address
      opts.log?.(`Network search not available: ${err.message}`);
      sock.close();
      resolve(() => {});
    });
    sock.bind(opts.port ?? DISCOVERY_PORT, () =>
      resolve(() => {
        try {
          sock.close();
        } catch {
          /* already closed */
        }
      }),
    );
  });
}

/** Broadcast addresses of this computer's networks (192.168.1.255 …) */
export function broadcastAddresses(): string[] {
  const out = new Set<string>(["255.255.255.255"]);
  for (const n of Object.values(networkInterfaces()).flat()) {
    if (!n || n.family !== "IPv4" || n.internal) continue;
    const ip = n.address.split(".").map(Number);
    const mask = n.netmask.split(".").map(Number);
    out.add(ip.map((b, i) => (b & mask[i]) | (~mask[i] & 255)).join("."));
  }
  return [...out];
}

/** Counter: ask the shop network, list every main computer that answers */
export function findMainComputers(
  opts: { timeoutMs?: number; port?: number; targets?: string[] } = {},
): Promise<FoundComputer[]> {
  const found = new Map<string, FoundComputer>();
  const sock: Socket = createSocket({ type: "udp4", reuseAddr: true });
  return new Promise((resolve) => {
    const done = () => {
      try {
        sock.close();
      } catch {
        /* already closed */
      }
      resolve([...found.values()]);
    };
    sock.on("message", (msg, from) => {
      try {
        const r = JSON.parse(msg.toString()) as {
          service?: string;
          shop?: string;
          port?: number;
        };
        if (r.service !== "medicare-server" || !Number.isInteger(r.port))
          return;
        const url = `http://${from.address}:${r.port}`;
        found.set(url, { url, shop: String(r.shop ?? "").slice(0, 100) });
      } catch {
        /* not ours */
      }
    });
    sock.once("error", done);
    sock.bind(0, () => {
      sock.setBroadcast(true);
      for (const to of opts.targets ?? broadcastAddresses())
        sock.send(ASK, opts.port ?? DISCOVERY_PORT, to);
      setTimeout(done, opts.timeoutMs ?? 1500);
    });
  });
}
