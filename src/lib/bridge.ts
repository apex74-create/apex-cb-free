/**
 * ADB bridge configuration.
 *
 * The watch never speaks ADB itself — it talks to a bridge agent that runs
 * `adb` on the user's behalf. Three agent kinds are supported and tried in
 * priority order so a dead link falls through to the next one:
 *
 *  1. "server"  — PC / always-on box on the LAN (primary)
 *  2. "phone"   — Termux-style agent on the paired phone
 *  3. "relay"   — hosted relay both sides dial out to (works on 4G, no ports)
 */

export type BridgeKind = "server" | "phone" | "relay";

export type BridgeEndpoint = {
  id: string;
  kind: BridgeKind;
  label: string;
  /** ws:// or wss:// base URL of the agent socket */
  url: string;
  enabled: boolean;
  /** Optional shared token sent in the hello frame */
  token?: string;
};

export type LinkState = "idle" | "connecting" | "agent" | "online" | "failing" | "offline";

export const KIND_LABEL: Record<BridgeKind, string> = {
  server: "PC AGENT",
  phone: "PHONE",
  relay: "RELAY",
};

const KEY = "apex.bridge.endpoints";
const TARGET_KEY = "apex.bridge.target";

/** Wireless-debugging connect address. Android can rotate this port. */
export const DEFAULT_TARGET = "192.168.12.211:33213";

/** Agent listen port used by agent/adb-bridge-agent.mjs. */
export const AGENT_PORT = 8787;

/**
 * Hosts that only ever existed as placeholders. Dialing them forever is the
 * "keeps trying the same ports" symptom, so stored copies get rewritten.
 */
const STALE_HOSTS = ["192.168.1.42", "192.168.1.60", "relay.example.net"];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** Host the page itself is served from — the usual PC-agent host when self-hosted. */
function pageHost(): string | null {
  if (typeof window === "undefined") return null;
  // The hosted PWA origin is not an ADB bridge. Deriving an agent from an
  // HTTPS website hostname creates a guaranteed-dead ws:// endpoint.
  if (window.location.protocol === "https:") return null;
  return window.location.hostname || null;
}

/** Browsers only allow wss:// sockets from an HTTPS page. */
export function isSecurePage(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

/** Scheme the current page is allowed to dial. */
export function socketScheme(): "ws" | "wss" {
  return isSecurePage() ? "wss" : "ws";
}

/** Rewrite a ws:// URL to wss:// (no-op when already secure or empty). */
export function toSecureUrl(url: string): string {
  return url.startsWith("ws://") ? `wss://${url.slice("ws://".length)}` : url;
}

/**
 * Defaults derived from what we actually know instead of invented IPs:
 * the phone's wireless-debugging host, and the host serving this page.
 */
export function defaultEndpoints(target = DEFAULT_TARGET): BridgeEndpoint[] {
  const phoneHost = target.split(":")[0]?.trim() || "192.168.12.211";
  const scheme = socketScheme();
  const pc = pageHost();
  const list: BridgeEndpoint[] = [
    {
      id: "phone",
      kind: "phone",
      label: `Phone agent (${phoneHost})`,
      url: `${scheme}://${phoneHost}:${AGENT_PORT}/adb`,
      // A wss:// dial is always allowed from an HTTPS page; if the agent has
      // no trusted cert the dial simply fails and we fail over. Leaving this
      // off produced the "no bridge endpoint is enabled" dead end.
      enabled: true,
    },
  ];
  if (pc && pc !== phoneHost) {
    list.push({
      id: "server",
      kind: "server",
      label: `PC agent (${pc})`,
      url: `ws://${pc}:${AGENT_PORT}/adb`,
      enabled: true,
    });
  }
  list.push({
    id: "relay",
    kind: "relay",
    label: "Cloud relay (4G) — set wss:// URL",
    url: "",
    // Disabled until a real wss:// relay is entered; an empty dial can never win.
    enabled: false,
  });
  return list;
}

export const DEFAULT_ENDPOINTS: BridgeEndpoint[] = defaultEndpoints();

export function loadTarget(): string {
  if (typeof window === "undefined") return DEFAULT_TARGET;
  return window.localStorage.getItem(TARGET_KEY) ?? DEFAULT_TARGET;
}

export function saveTarget(target: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TARGET_KEY, target.trim());
}

/** Drop placeholder hosts and empty URLs so the dial loop only tries real ones. */
function sanitize(list: BridgeEndpoint[], target: string): BridgeEndpoint[] {
  const cleaned = list.map((e) => {
    const host = hostOf(e.url);
    const isFalseHostedAgent =
      typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      host === window.location.hostname &&
      e.url.startsWith("ws://");
    if (isFalseHostedAgent) return { ...e, enabled: false };
    if (!e.url || STALE_HOSTS.includes(host)) {
      const fresh = defaultEndpoints(target).find((d) => d.id === e.id);
      return fresh ? { ...fresh } : { ...e, enabled: false };
    }
    return e;
  });
  // A stored config where every usable endpoint is switched off is a dead end
  // ("no bridge endpoint is enabled"). Re-arm anything the page is allowed to
  // dial before giving up on the stored list.
  if (!cleaned.some((e) => e.enabled && e.url)) {
    const scheme = socketScheme();
    const armed = cleaned.map((e) =>
      e.url && e.url.startsWith(`${scheme}://`) ? { ...e, enabled: true } : e,
    );
    if (armed.some((e) => e.enabled && e.url)) return armed;
    return defaultEndpoints(target);
  }
  return cleaned;
}

export function loadEndpoints(): BridgeEndpoint[] {
  if (typeof window === "undefined") return DEFAULT_ENDPOINTS;
  const target = loadTarget();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultEndpoints(target);
    const parsed = JSON.parse(raw) as BridgeEndpoint[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultEndpoints(target);
    return sanitize(parsed, target);
  } catch {
    return defaultEndpoints(target);
  }
}

export function saveEndpoints(endpoints: BridgeEndpoint[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(endpoints));
}

/* ---- Wire protocol ---------------------------------------------------- */

export type OutFrame =
  | { type: "hello"; client: "apex-watch"; token?: string }
  | { type: "devices"; id: string }
  | { type: "shell"; id: string; cmd: string; serial?: string }
  | { type: "connect"; id: string; target: string }
  /** Ask the agent to find the current wireless-debugging port itself. */
  | { type: "autoconnect"; id: string; host?: string }
  | { type: "assembly"; id: string; serial?: string }
  | { type: "pair"; id: string; target: string; code: string };

export type InFrame =
  | { type: "hello"; agent?: string; adb?: string }
  | { type: "paired"; id: string; target: string; ok: boolean; output: string }
  | { type: "connected"; id: string; target: string; ok: boolean; output: string }
  | { type: "devices"; id: string; devices: { serial: string; state: string }[] }
  | { type: "result"; id: string; ok: boolean; output: string; code?: number }
  | { type: "error"; id?: string; message: string };

export function parseFrame(raw: string): InFrame | null {
  try {
    const data = JSON.parse(raw) as InFrame;
    return data && typeof data.type === "string" ? data : null;
  } catch {
    return null;
  }
}
