/**
 * Automatic phone LAN address detection.
 *
 * The relay / PCAPdroid HTTP daemon must be reached on the phone's *routable*
 * address — never 127.0.0.1, and never the VPN tun0 address PCAPdroid installs.
 * Rather than asking the user to copy an IP by hand, we read every interface
 * off the device over the bridge and pick the best one.
 */

import { useLiveCommand } from "./live-data";

/** One line per interface, so we can rank them instead of grabbing the first. */
export const LAN_IP_CMD =
  "shell ip -o -f inet addr show scope global 2>/dev/null || ip -f inet addr";

export type Iface = { name: string; ip: string; cidr: number };

/** Loopback, VPN tunnels and docker-ish bridges are never valid relay targets. */
const REJECT = /^(lo|tun\d|ppp\d|dummy|docker|ap\d)/;

/** Wi-Fi first (real LAN), then ethernet/USB tether, then mobile data last. */
function rank(name: string): number {
  if (/^wlan/.test(name)) return 0;
  if (/^(eth|usb|rndis|ncm)/.test(name)) return 1;
  if (/^(swlan|bt-pan|p2p)/.test(name)) return 2;
  if (/^rmnet|^ccmni|^v4-rmnet/.test(name)) return 3;
  return 4;
}

export function parseIfaces(out: string): Iface[] {
  const list: Iface[] = [];
  for (const line of out.split("\n")) {
    // `ip -o` form: "23: wlan0    inet 192.168.12.211/24 brd ..."
    const m = line.match(/^\s*\d+:\s*([\w.-]+)\s+inet\s+(\d+\.\d+\.\d+\.\d+)\/(\d+)/);
    if (m) {
      list.push({ name: m[1]!, ip: m[2]!, cidr: Number(m[3]) });
      continue;
    }
    // multi-line `ip addr` fallback is handled by a looser match
    const n = line.match(/inet\s+(\d+\.\d+\.\d+\.\d+)\/(\d+).*?\s([\w.-]+)\s*$/);
    if (n) list.push({ name: n[3]!, ip: n[1]!, cidr: Number(n[2]) });
  }
  return list.filter((i) => !REJECT.test(i.name) && !i.ip.startsWith("127."));
}

/** Best routable address for a relay/daemon URL, or null when nothing qualifies. */
export function pickLanIp(out: string): Iface | null {
  const sorted = parseIfaces(out).sort((a, b) => rank(a.name) - rank(b.name));
  return sorted[0] ?? null;
}

export function isLoopback(host: string): boolean {
  return /^(127\.|localhost$|::1$)/.test(host.trim());
}

/** Build the daemon URL the relay should dial. */
export function daemonUrl(ip: string | null, port: number): string | null {
  return ip ? `http://${ip}:${port}/` : null;
}

/**
 * Live phone LAN address off the bridge. Polls slowly — the address only
 * changes when the phone hops networks.
 */
export function usePhoneLanIp(intervalMs = 15000) {
  const { data, error, loading, at, refresh } = useLiveCommand<Iface | null>(
    LAN_IP_CMD,
    pickLanIp,
    intervalMs,
  );
  return { iface: data, error, loading, at, refresh };
}
