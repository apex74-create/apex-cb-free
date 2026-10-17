/**
 * Automatic LAN host detection for the connect fields.
 *
 * Three independent sources are merged so the fields prefill without anyone
 * typing an IP:
 *
 *  1. the host serving this page (the usual PC-agent box when self-hosted)
 *  2. the browser's own private address, learned from a WebRTC host candidate
 *  3. the phone's routable interface, read over the bridge (see lan-ip.ts)
 *
 * WebRTC gives an mDNS name (`*.local`) on hardened browsers; that is kept as
 * a candidate anyway because it still resolves on the same LAN, but it is
 * ranked below a literal RFC1918 address.
 */

export type HostCandidate = {
  host: string;
  source: "page" | "webrtc" | "phone" | "target" | "loopback";
  label: string;
  /** lower sorts first */
  rank: number;
};

export function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host.trim());
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Read one private host candidate out of WebRTC ICE gathering. */
export function detectLocalIp(timeoutMs = 1500): Promise<string | null> {
  if (typeof window === "undefined" || typeof RTCPeerConnection === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: [] });
    } catch {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        pc.close();
      } catch {
        /* already closed */
      }
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);

    pc.onicecandidate = (event) => {
      const cand = event.candidate?.candidate;
      if (!cand) return;
      const ip = /([0-9]{1,3}(?:\.[0-9]{1,3}){3})/.exec(cand)?.[1];
      if (ip && isPrivateIpv4(ip)) {
        finish(ip);
        return;
      }
      const mdns = /([0-9a-f-]{36}\.local)/i.exec(cand)?.[1];
      if (mdns) finish(mdns);
    };
    try {
      pc.createDataChannel("apex");
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => finish(null));
    } catch {
      finish(null);
    }
  });
}

/** The /24 siblings of a private address — used to widen a scan. */
export function subnetOf(host: string): string | null {
  const m = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/.exec(host.trim());
  return m && isPrivateIpv4(host) ? m[1]! : null;
}

/** Merge every known source into a ranked, de-duplicated candidate list. */
export function rankHosts(input: {
  pageHost?: string | null;
  pageIsHttps?: boolean;
  webrtcHost?: string | null;
  phoneIp?: string | null;
  phoneIface?: string | null;
  adbTarget?: string | null;
}): HostCandidate[] {
  const out: HostCandidate[] = [];
  const add = (
    host: string | null | undefined,
    source: HostCandidate["source"],
    label: string,
    rank: number,
  ) => {
    const clean = (host ?? "").trim();
    if (!clean || out.some((c) => c.host === clean)) return;
    out.push({ host: clean, source, label, rank });
  };

  add(
    input.phoneIp,
    "phone",
    `phone ${input.phoneIface ?? "wlan"}`,
    isPrivateIpv4(input.phoneIp ?? "") ? 0 : 3,
  );
  add(input.adbTarget?.split(":")[0], "target", "adb target", 1);
  if (!input.pageIsHttps) add(input.pageHost, "page", "this host", 2);
  add(input.webrtcHost, "webrtc", "this device", isPrivateIpv4(input.webrtcHost ?? "") ? 2 : 4);
  add("127.0.0.1", "loopback", "localhost", 5);

  return out.sort((a, b) => a.rank - b.rank);
}
