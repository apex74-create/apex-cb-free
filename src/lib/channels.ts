/**
 * FM/CB-style group channels over Reticulum netchat.
 *
 * There is no broadcast primitive in LXMF — delivery is point-to-point. So a
 * "channel" here is a locally held roster plus a signed channel header carried
 * inside every payload. A PTT transmission fans the same header + text out to
 * every roster member; receivers bucket inbound traffic by the header instead
 * of by sender, which gives CB-radio semantics (tune, listen, key up) on top of
 * a unicast mesh.
 *
 * Header wire format (inside the token envelope, key `ch`):
 *   { n: 19, tag: "APEX-19", mode: "ptt" | "msg", sq: 3, ts: 1712... }
 *   n    channel number 1..40 (CB plan)
 *   tag  human channel label, also the grouping key across nodes
 *   sq   squelch/priority hint 0..9
 */

export type ChannelMode = "ptt" | "msg";

export type ChanHeader = {
  n: number;
  tag: string;
  mode: ChannelMode;
  sq: number;
  ts: number;
};

export type Channel = {
  /** 1..40, CB plan */
  n: number;
  tag: string;
  /** roster of LXMF destination hashes this channel fans out to */
  members: string[];
  /** squelch: ignore inbound traffic below this priority */
  sq: number;
  /** true when the watch buckets and shows this channel's traffic */
  listen: boolean;
};

const KEY = "apex.netchat.channels";
const KEY_ACTIVE = "apex.netchat.channel.active";

export const CB_MIN = 1;
/** Free public plan — the classic 40. */
export const CB_MAX = 40;
/** Highest digital bus a licence can reach (commercial plan). Above 40 is digital-only. */
export const CB_BUS_MAX = 270;

/**
 * Channel licensing plans. Channels are bus names, so the cap is a licence
 * variable, not a radio limit. Commercial adds private sub-channels for
 * foreman / in-field crews and field sensor access points.
 */
export const CHANNEL_PLANS = {
  free: { channels: 20, subChannels: false },
  pair: { channels: 80, subChannels: false },
  squad: { channels: 160, subChannels: true },
  commercial: { channels: 270, subChannels: true },
} as const;
export type ChannelPlan = keyof typeof CHANNEL_PLANS;
export const channelCap = (plan: ChannelPlan) => CHANNEL_PLANS[plan].channels;
/** Channel 9 is the emergency channel on the CB plan; 19 is the road channel. */
export const CB_EMERGENCY = 9;

export const defaultTag = (n: number) => `APEX-${String(n).padStart(2, "0")}`;

export function makeChannel(n: number): Channel {
  return { n, tag: defaultTag(n), members: [], sq: 0, listen: true };
}

export function loadChannels(): Channel[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as Channel[];
    const rows = raw
      .filter((c) => Number.isFinite(c?.n))
      .map((c) => ({ ...makeChannel(c.n), ...c }));
    return rows.length > 0 ? rows : [makeChannel(19), makeChannel(CB_EMERGENCY)];
  } catch {
    return [makeChannel(19), makeChannel(CB_EMERGENCY)];
  }
}

export function saveChannels(list: Channel[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    /* storage locked */
  }
}

export function loadActive(): number {
  if (typeof window === "undefined") return 19;
  const n = Number(window.localStorage.getItem(KEY_ACTIVE));
  return n >= CB_MIN && n <= CB_MAX ? n : 19;
}

export function saveActive(n: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_ACTIVE, String(n));
  } catch {
    /* storage locked */
  }
}

export function header(ch: Channel, mode: ChannelMode): ChanHeader {
  return { n: ch.n, tag: ch.tag, mode, sq: ch.sq, ts: Date.now() };
}

/** Pull a channel header out of an inbound envelope or raw text prefix. */
export function readHeader(token: unknown, content: string): ChanHeader | null {
  const c = token as { ch?: Partial<ChanHeader> } | undefined;
  const h = c?.ch;
  if (h && Number.isFinite(h.n)) {
    return {
      n: Number(h.n),
      tag: String(h.tag ?? defaultTag(Number(h.n))),
      mode: h.mode === "ptt" ? "ptt" : "msg",
      sq: Number(h.sq ?? 0),
      ts: Number(h.ts ?? 0),
    };
  }
  // Fallback for plain-text nodes: "[APEX-19] text"
  const m = /^\[([A-Z0-9-]{3,16})\]\s/.exec(content);
  if (!m) return null;
  const n = Number(/(\d+)$/.exec(m[1]!)?.[1] ?? 0);
  return { n, tag: m[1]!, mode: "msg", sq: 0, ts: 0 };
}

/** Plain-text prefix so non-Apex Reticulum clients still see the channel. */
export const textPrefix = (ch: Channel, text: string) => `[${ch.tag}] ${text}`;

/** Squelch test: does this channel want to hear that header? */
export function passesSquelch(ch: Channel, h: ChanHeader | null): boolean {
  if (!h) return false;
  if (h.tag !== ch.tag && h.n !== ch.n) return false;
  return h.sq >= ch.sq;
}
