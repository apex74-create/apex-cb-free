/**
 * CB rooms — the step-aside pattern from real radio traffic.
 *
 *   19        everyone meets on the calling channel, in the clear
 *   19.1      two operators step off to a side room
 *   19.1.1    a private room spawned from it, locked to invited handsets
 *
 * A room id is the channel number followed by dot-separated branch numbers.
 * The realtime room name is `ptt-<id>`, so a room is just another bus — the
 * carrier does not change and local links keep working with no uplink.
 *
 * Privacy: a private room carries a 16-character code. Every handset that
 * scanned or pasted the code derives the same AES-256-GCM key and can read
 * the payload; the relay and anyone else sees opaque bytes. Only the frame
 * header (room id, sender, timestamp) stays clear so the bus can route.
 *
 * This is digital transport over Wi-Fi / Bluetooth / USB — unlicensed Part 15
 * data, not a CB emission, so encryption is allowed here. Audio handed to a
 * 27 MHz radio through a cable jack stays in the clear.
 */

import { CB_MAX, CB_MIN } from "@/lib/channels";
import { packTriStarHeader } from "@/lib/engines/tristar-addressing";

export type Room = {
  /** "19", "19.1", "19.1.1" */
  id: string;
  /** base CB channel this room hangs off */
  channel: number;
  /** present when the room is end-to-end encrypted */
  code?: string;
  label: string;
};

const ROOMS_KEY = "apex.cb.rooms";
const ACTIVE_KEY = "apex.cb.room.active";
const COORD_KEY = "apex.cb.coord";

/* ---- room ids ---------------------------------------------------------- */

export function parseRoomId(id: string): { channel: number; branches: number[] } | null {
  const parts = id.split(".");
  const channel = Number(parts[0]);
  if (!Number.isInteger(channel) || channel < CB_MIN || channel > CB_MAX) return null;
  const branches = parts.slice(1).map(Number);
  if (branches.some((b) => !Number.isInteger(b) || b < 1 || b > 99)) return null;
  return { channel, branches };
}

export const roomChannel = (id: string): number => parseRoomId(id)?.channel ?? 19;

export const roomBusName = (id: string): string => {
  const p = parseRoomId(id);
  if (!p) return "ptt-19";
  return `ptt-${[String(p.channel).padStart(2, "0"), ...p.branches].join(".")}`;
};

export const isPrivateRoom = (r: Room): boolean => !!r.code;

/** Next free branch under a room, e.g. "19" -> "19.1" -> "19.2". */
export function childRoomId(parent: string, taken: string[]): string {
  for (let i = 1; i < 100; i++) {
    const id = `${parent}.${i}`;
    if (!taken.includes(id)) return id;
  }
  return `${parent}.99`;
}

export function roomCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...b))
    .replace(/[+/=]/g, "")
    .slice(0, 16);
}

/* ---- persistence ------------------------------------------------------- */

export function loadRooms(): Room[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(ROOMS_KEY) ?? "[]") as Room[];
    return raw.filter((r) => typeof r?.id === "string" && parseRoomId(r.id));
  } catch {
    return [];
  }
}

export function saveRooms(list: Room[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROOMS_KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    /* storage locked */
  }
}

export function upsertRoom(room: Room): Room[] {
  const next = [...loadRooms().filter((r) => r.id !== room.id), room].sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true }),
  );
  saveRooms(next);
  return next;
}

export function removeRoom(id: string): Room[] {
  const next = loadRooms().filter((r) => r.id !== id);
  saveRooms(next);
  return next;
}

export function loadActiveRoom(): string {
  if (typeof window === "undefined") return "19";
  const v = window.localStorage.getItem(ACTIVE_KEY) ?? "";
  return parseRoomId(v) ? v : "19";
}

export function saveActiveRoom(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* storage locked */
  }
}

/* ---- invites ----------------------------------------------------------- */

/** Shareable invite: "APEXCB:<roomId>:<code>". */
export const roomInvite = (r: Room): string => `APEXCB:${r.id}:${r.code ?? ""}`;

export function parseInvite(text: string): Room | null {
  const m = /^APEXCB:([0-9.]+):([A-Za-z0-9]*)$/.exec(text.trim());
  if (!m) return null;
  const id = m[1]!;
  if (!parseRoomId(id)) return null;
  const base: Room = { id, channel: roomChannel(id), label: `ROOM ${id}` };
  return m[2] ? { ...base, code: m[2] } : base;
}

/* ---- payload encryption ------------------------------------------------ */

const enc = new TextEncoder();
const dec = new TextDecoder();
const keyCache = new Map<string, CryptoKey>();

export async function deriveRoomKey(code: string): Promise<CryptoKey> {
  const hit = keyCache.get(code);
  if (hit) return hit;
  const raw = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, [
    "deriveKey",
  ]);
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("apex-cb-room"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  keyCache.set(code, key);
  return key;
}

const b64 = (b: Uint8Array) => {
  let s = "";
  b.forEach((v) => (s += String.fromCharCode(v)));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Prefix marks an encrypted payload so mixed traffic still reads cleanly. */
export const CIPHER_PREFIX = "E1:";

export async function encryptBody(key: CryptoKey, body: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(body)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return CIPHER_PREFIX + b64(out);
}

export async function decryptBody(key: CryptoKey, payload: string): Promise<string | null> {
  if (!payload.startsWith(CIPHER_PREFIX)) return payload;
  try {
    const bytes = unb64(payload.slice(CIPHER_PREFIX.length));
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) },
      key,
      bytes.slice(12),
    );
    return dec.decode(pt);
  } catch {
    return null;
  }
}

/* ---- spatial stamp ----------------------------------------------------- */

/** This handset's Tri-Star coordinate, generated once and kept locally. */
export function localCoordinate(): bigint {
  if (typeof window === "undefined") return 0n;
  try {
    const v = window.localStorage.getItem(COORD_KEY);
    if (v) return BigInt(v);
    const gen = BigInt(crypto.getRandomValues(new Uint32Array(1))[0]!);
    window.localStorage.setItem(COORD_KEY, gen.toString());
    return gen;
  } catch {
    return 0n;
  }
}

/** 4-byte Tri-Star header as hex, carried on every digital-link frame. */
export function spatialHeaderHex(coordinate = localCoordinate()): string {
  return Array.from(packTriStarHeader(coordinate, 0))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Provenance stamp: a short traversal digest over room, sender, time and
 * spatial coordinate. Proof of origin for field telemetry — no financial or
 * transactional meaning.
 */
export async function provenanceStamp(
  roomId: string,
  from: string,
  ts: number,
): Promise<string> {
  const pre = `${roomId}|${from}|${ts}|${spatialHeaderHex()}`;
  const d = await crypto.subtle.digest("SHA-256", enc.encode(pre));
  return Array.from(new Uint8Array(d).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
