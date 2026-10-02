/**
 * Bridgeless PTT — plain push-to-talk over the Cloud realtime bus.
 *
 * The Reticulum netchat path needs the ADB bridge + a phone agent. This one
 * does not: any browser (watch, phone, tablet) that can reach the network can
 * tune a CB channel and key up. Voice is captured with MediaRecorder and fanned
 * out as a base64 broadcast; when the recorder is missing (old WebViews) the
 * same channel still carries text transmissions.
 */
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { readLevels } from "@/lib/cb-audio-levels";
import { defaultTag } from "@/lib/channels";
import { onLinkFrame, sendAll, type LinkFrame } from "@/lib/cb-links";
import {
  CIPHER_PREFIX,
  decryptBody,
  encryptBody,
  provenanceStamp,
  roomBusName,
  spatialHeaderHex,
} from "@/lib/rooms";

export type PttKind = "voice" | "text";

export type PttTx = {
  id: string;
  kind: PttKind;
  from: string;
  ch: number;
  tag: string;
  ts: number;
  /** text body, or a data: URL for voice */
  body: string;
  mine?: boolean;
  /** 4-byte Tri-Star spatial header, hex — digital links only */
  tri?: string;
  /** short traversal/provenance digest */
  seal?: string;
  /** relay hops this frame travelled to reach us */
  hops?: number;
};

const CALL_KEY = "apex.ptt.callsign";
/** Realtime payloads are capped; keep a transmission short like a real key-up. */
export const MAX_KEY_MS = 8000;

export function loadCallsign(): string {
  if (typeof window === "undefined") return "APEX";
  const v = window.localStorage.getItem(CALL_KEY);
  if (v) return v;
  const gen = `APEX-${Math.floor(Math.random() * 900 + 100)}`;
  try {
    window.localStorage.setItem(CALL_KEY, gen);
  } catch {
    /* storage locked */
  }
  return gen;
}

export function saveCallsign(v: string) {
  try {
    window.localStorage.setItem(CALL_KEY, v.slice(0, 12).toUpperCase());
  } catch {
    /* storage locked */
  }
}

export const roomOf = (n: number) => `ptt-${String(n).padStart(2, "0")}`;

export function canRecord(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export type TuneOptions = {
  /**
   * Room id ("19", "19.1", "19.1.1"). Defaults to the bare channel number.
   * Rooms are separate buses on the same carriers.
   */
  roomId?: string;
  /**
   * AES-GCM key for a private room. When present every payload is encrypted
   * before it leaves the handset and decrypted on arrival; the frame header
   * stays clear so the bus can still route.
   */
  key?: CryptoKey | null;
};

/**
 * Tune a channel or room. Cloud relay plus every local link (field mesh, USB).
 * The relay rejoins by itself after drops, sleep and network switches;
 * transmissions made while it is down are queued and resent on rejoin.
 */
export function tune(
  n: number,
  onTx: (tx: PttTx) => void,
  onState: (s: "joining" | "live" | "down") => void,
  opts: TuneOptions = {},
): {
  transmit: (tx: Omit<PttTx, "id" | "ts" | "ch" | "tag">) => void;
  leave: () => void;
} {
  const roomId = opts.roomId ?? String(n);
  const key = opts.key ?? null;
  const bus = roomBusName(roomId);
  const tag = roomId.includes(".") ? `ROOM ${roomId}` : defaultTag(n);
  let channel: RealtimeChannel | null = null;
  let live = false;
  let left = false;
  let retry = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const queue: PttTx[] = [];
  const heard = new Set<string>();

  const inbound = (p: Partial<PttTx & LinkFrame>) => {
    if (!p?.body || p.digitalOnly || (p.ch !== undefined && Number(p.ch) !== n) || (p.roomId !== undefined && p.roomId !== roomId)) return;
    const id = String(p.id ?? Math.random());
    if (heard.has(id)) return;
    heard.add(id);
    if (heard.size > 500) heard.clear();
    const hops = Number(p.hops ?? 0);
    const emit = (body: string) =>
      onTx({
        id,
        kind: p.kind === "voice" ? "voice" : "text",
        from: String(p.from ?? "UNKNOWN"),
        ch: n,
        tag,
        ts: Number(p.ts ?? Date.now()),
        body,
        ...(hops > 0 ? { hops } : {}),
      });
    const raw = String(p.body);
    if (key && raw.startsWith(CIPHER_PREFIX)) {
      void decryptBody(key, raw).then((clear) => {
        if (clear !== null) emit(clear);
      });
      return;
    }
    // A locked room ignores anything it cannot read.
    if (key) return;
    emit(raw);
  };


  const flush = () => {
    while (live && channel && queue.length) {
      const tx = queue.shift()!;
      void channel.send({ type: "broadcast", event: "tx", payload: tx });
    }
  };

  const join = () => {
    if (left) return;
    if (channel) void supabase.removeChannel(channel);
    live = false;
    onState("joining");
    const c = supabase.channel(bus, { config: { broadcast: { self: false } } });
    channel = c;
    c.on("broadcast", { event: "tx" }, ({ payload }) => inbound(payload as Partial<PttTx>));
    c.subscribe((status) => {
      if (c !== channel) return;
      if (status === "SUBSCRIBED") {
        live = true;
        retry = 0;
        onState("live");
        flush();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        live = false;
        onState("down");
        schedule();
      }
    });
  };

  const schedule = () => {
    if (left || timer) return;
    const wait = Math.min(15000, 1000 * 2 ** retry++);
    timer = setTimeout(() => {
      timer = null;
      join();
    }, wait);
  };

  const wake = () => {
    if (!live && !left) {
      retry = 0;
      if (timer) clearTimeout(timer);
      timer = null;
      join();
    }
  };
  const onVis = () => document.visibilityState === "visible" && wake();
  window.addEventListener("online", wake);
  document.addEventListener("visibilitychange", onVis);
  const offLinks = onLinkFrame((f) => inbound(f));

  join();

  const dispatch = (full: PttTx) => {
    heard.add(full.id);
    sendAll({ id: full.id, ch: n, roomId, from: full.from, kind: full.kind, body: full.body, ts: full.ts });
    if (live && channel) void channel.send({ type: "broadcast", event: "tx", payload: full });
    else queue.push(full), queue.splice(0, Math.max(0, queue.length - 10));
  };

  const transmit = (tx: Omit<PttTx, "id" | "ts" | "ch" | "tag">) => {
    const full: PttTx = {
      ...tx,
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      ts: Date.now(),
      ch: n,
      tag,
    };
    // Show the operator their own transmission in the clear straight away.
    onTx({ ...full, mine: true });
    void (async () => {
      const body = key ? await encryptBody(key, full.body) : full.body;
      const seal = await provenanceStamp(roomId, full.from, full.ts).catch(() => "");
      dispatch({ ...full, body, tri: spatialHeaderHex(), seal } as PttTx);
    })();
  };

  return {
    transmit,
    leave: () => {
      left = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", onVis);
      offLinks();
      if (channel) void supabase.removeChannel(channel);
    },
  };
}

/** Hold-to-talk mic capture. Resolves to a data: URL on release. */
export async function openMic(): Promise<{
  start: () => void;
  stop: () => Promise<string | null>;
  close: () => void;
}> {
  const raw = await navigator.mediaDevices.getUserMedia({ audio: true });
  // TX level: route the mic through a gain stage before encoding.
  let stream = raw;
  let ctx: AudioContext | null = null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      ctx = new AC();
      const g = ctx.createGain();
      g.gain.value = readLevels().tx;
      const dest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(raw).connect(g).connect(dest);
      stream = dest.stream;
    }
  } catch {
    stream = raw;
  }
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
  let rec: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  return {
    start: () => {
      chunks = [];
      void ctx?.resume();
      rec = new MediaRecorder(
        stream,
        mime ? { mimeType: mime, audioBitsPerSecond: 16000 } : undefined,
      );
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.start();
    },
    stop: () =>
      new Promise((resolve) => {
        const r = rec;
        if (!r || r.state === "inactive") return resolve(null);
        r.onstop = () => {
          const blob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" });
          if (blob.size === 0 || blob.size > 220_000) return resolve(null);
          const fr = new FileReader();
          fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : null);
          fr.onerror = () => resolve(null);
          fr.readAsDataURL(blob);
        };
        r.stop();
      }),
    close: () => {
      raw.getTracks().forEach((t) => t.stop());
      void ctx?.close();
    },
  };
}

/* ---------------------------------------------------------------------- */
/* Mic permission + channel presets                                        */
/* ---------------------------------------------------------------------- */

export type MicPerm = "unknown" | "prompt" | "granted" | "denied" | "unsupported";

/** Read the current mic permission without opening the mic, when possible. */
export async function micPermission(): Promise<MicPerm> {
  if (!canRecord()) return "unsupported";
  const q = (navigator as Navigator & { permissions?: Permissions }).permissions;
  if (!q?.query) return "unknown";
  try {
    const st = await q.query({ name: "microphone" as PermissionName });
    return st.state === "granted" ? "granted" : st.state === "denied" ? "denied" : "prompt";
  } catch {
    return "unknown";
  }
}

/** Explicit one-tap grant flow: opens and immediately releases the mic. */
export async function requestMic(): Promise<MicPerm> {
  if (!canRecord()) return "unsupported";
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch {
    return "denied";
  }
}

const FAV_KEY = "apex.ptt.favorites";

export function loadFavorites(): number[] {
  if (typeof window === "undefined") return [9, 19];
  try {
    const raw = JSON.parse(window.localStorage.getItem(FAV_KEY) ?? "null") as number[] | null;
    if (!Array.isArray(raw)) return [9, 19];
    return raw.filter((n) => Number.isFinite(n) && n >= 1 && n <= 40).slice(0, 6);
  } catch {
    return [9, 19];
  }
}

export function toggleFavorite(n: number): number[] {
  const cur = loadFavorites();
  const next = cur.includes(n)
    ? cur.filter((c) => c !== n)
    : [...cur, n].slice(-6).sort((a, b) => a - b);
  try {
    window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
  } catch {
    /* storage locked */
  }
  return next;
}
