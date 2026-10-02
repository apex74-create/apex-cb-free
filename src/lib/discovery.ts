/**
 * One-tap agent discovery.
 *
 * The watch cannot enumerate the LAN directly (no raw sockets in the browser),
 * so discovery is an active sweep: every candidate `ws://host:port/adb` gets a
 * real WebSocket handshake plus a `hello` frame. An agent answers with its own
 * `hello` (agent name + adb version); anything else is not our agent.
 *
 * Candidates come from what we actually know:
 *  - the hosts already configured in the failover chain
 *  - the phone's wireless-debugging target host
 *  - the /24 around those hosts (Wi-Fi case)
 *  - any wss:// relay already configured (works on 4G, no LAN sweep possible)
 */

import { parseFrame, type BridgeEndpoint } from "./bridge";

export type FoundAgent = {
  url: string;
  host: string;
  agent: string;
  adb: string | null;
  ms: number;
};

export type ScanProgress = {
  done: number;
  total: number;
  found: FoundAgent[];
  scanning: boolean;
  note: string | null;
};

export const AGENT_PORTS = [8787, 8788];
const PATH = "/adb";

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

/** true when the page is HTTPS and the browser will block plain ws:// */
export function insecureBlocked(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

/** Build the candidate URL list, de-duplicated and ordered most-likely-first. */
export function buildCandidates(endpoints: BridgeEndpoint[], target: string): string[] {
  const urls: string[] = [];
  const push = (u: string) => {
    if (!urls.includes(u)) urls.push(u);
  };

  const seedHosts: string[] = [];
  for (const e of endpoints) {
    const h = hostOf(e.url);
    if (e.url.startsWith("wss://"))
      push(e.url); // relay: probe as-is
    else if (h) {
      push(e.url);
      seedHosts.push(h);
    }
  }

  const targetHost = target.split(":")[0]?.trim();
  if (targetHost) seedHosts.push(targetHost);
  if (typeof window !== "undefined" && window.location.hostname) {
    seedHosts.push(window.location.hostname);
  }

  // exact seed hosts on every known agent port first
  for (const h of seedHosts) {
    for (const p of AGENT_PORTS) push(`ws://${h}:${p}${PATH}`);
  }

  // then sweep the /24 of each distinct IPv4 seed subnet on the primary port
  const subnets = new Set<string>();
  for (const h of seedHosts) {
    const m = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/.exec(h);
    if (m) subnets.add(m[1]!);
  }
  for (const base of subnets) {
    for (let i = 1; i < 255; i++) push(`ws://${base}.${i}:${AGENT_PORTS[0]}${PATH}`);
  }

  return insecureBlocked() ? urls.filter((u) => u.startsWith("wss://")) : urls;
}

/** Handshake a single candidate. Resolves null for anything that isn't an agent. */
export function probeAgent(url: string, timeoutMs = 1400): Promise<FoundAgent | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (value: FoundAgent | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        /* already closing */
      }
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);

    socket.onopen = () => socket.send(JSON.stringify({ type: "hello", client: "apex-watch" }));
    socket.onerror = () => finish(null);
    socket.onclose = () => finish(null);
    socket.onmessage = (event) => {
      const frame = parseFrame(String(event.data));
      if (frame?.type !== "hello") return;
      finish({
        url,
        host: hostOf(url) ?? url,
        agent: frame.agent ?? "agent",
        adb: frame.adb ?? null,
        ms: Date.now() - started,
      });
    };
  });
}

/**
 * Sweep candidates with bounded concurrency so a 254-host /24 stays responsive
 * on watch hardware. `signal` aborts mid-sweep; `onProgress` streams hits.
 */
export async function discoverAgents(
  candidates: string[],
  onProgress: (done: number, found: FoundAgent | null) => void,
  signal?: AbortSignal,
  concurrency = 24,
  timeoutMs = 1400,
): Promise<FoundAgent[]> {
  const found: FoundAgent[] = [];
  let cursor = 0;
  let done = 0;

  const worker = async () => {
    while (cursor < candidates.length && !signal?.aborted) {
      const url = candidates[cursor++]!;
      const hit = await probeAgent(url, timeoutMs);
      done += 1;
      if (hit) found.push(hit);
      onProgress(done, hit);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, worker));
  return found;
}
