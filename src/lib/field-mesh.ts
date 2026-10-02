/**
 * Field mesh — phone-to-phone CB with no server and no internet.
 *
 * Phones on any shared Wi-Fi (a phone hotspot, a field AP) link directly
 * over WebRTC data channels. There is no signaling server: the invite and
 * the reply travel as QR codes (or copied text). No STUN/TURN, so traffic
 * never leaves the local network. Each pair is one link; frames are flooded
 * across links with dedupe, so the group daisy-chains — any member can
 * invite the next phone.
 *
 * Every frame is AES-GCM encrypted with a key derived from the group code
 * carried in the invite. Only phones that scanned an invite can read it.
 */
import { deliver, registerLink, unregisterLink, type LinkFrame } from "@/lib/cb-links";

const CHUNK = 12_000;
const GROUP_KEY = "apex.mesh.group";

type Peer = { pc: RTCPeerConnection; dc: RTCDataChannel | null; label: string };
const peers = new Set<Peer>();
let key: CryptoKey | null = null;
let group = "";
const subs = new Set<(n: number) => void>();

function notify() {
  const n = [...peers].filter((p) => p.dc?.readyState === "open").length;
  subs.forEach((s) => s(n));
  if (n > 0) registerLink({ kind: "mesh", send: broadcast, carriesVoice: true });
  else unregisterLink("mesh");
}

export function onPeerCount(cb: (n: number) => void): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function meshSupported(): boolean {
  return typeof RTCPeerConnection !== "undefined" && !!globalThis.crypto?.subtle;
}

/* ---- group key -------------------------------------------------------- */

function randomCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, "").slice(0, 16);
}

async function setGroup(code: string) {
  group = code;
  try {
    localStorage.setItem(GROUP_KEY, code);
  } catch {
    /* storage locked */
  }
  const raw = await crypto.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, [
    "deriveKey",
  ]);
  key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new TextEncoder().encode("apex-cb-field-mesh"), iterations: 100_000, hash: "SHA-256" },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function ensureGroup(): Promise<string> {
  if (key) return group;
  let code = "";
  try {
    code = localStorage.getItem(GROUP_KEY) ?? "";
  } catch {
    /* storage locked */
  }
  await setGroup(code || randomCode());
  return group;
}

export function currentGroup(): string {
  return group;
}

export async function newGroup(): Promise<string> {
  await setGroup(randomCode());
  return group;
}

/* ---- invite codes (compressed SDP) ------------------------------------ */

async function pack(obj: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let out = bytes;
  if (typeof CompressionStream !== "undefined") {
    const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    out = new Uint8Array(await new Response(s).arrayBuffer());
  }
  let bin = "";
  out.forEach((b) => (bin += String.fromCharCode(b)));
  return (typeof CompressionStream !== "undefined" ? "Z" : "J") + btoa(bin);
}

async function unpack<T>(code: string): Promise<T> {
  const c = code.trim();
  const bin = Uint8Array.from(atob(c.slice(1)), (ch) => ch.charCodeAt(0));
  let bytes = bin;
  if (c[0] === "Z") {
    const s = new Blob([bin]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    bytes = new Uint8Array(await new Response(s).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function waitIce(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const t = setTimeout(resolve, 4000);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(t);
        resolve();
      }
    });
  });
}

function newPeer(label: string): Peer {
  const pc = new RTCPeerConnection({ iceServers: [] }); // LAN only, no servers
  const peer: Peer = { pc, dc: null, label };
  peers.add(peer);
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      peers.delete(peer);
      notify();
    }
  });
  return peer;
}

/** Step 1 (inviter): make an invite code to show as a QR. */
export async function createInvite(): Promise<{ code: string; accept: (reply: string) => Promise<void> }> {
  const g = await ensureGroup();
  const peer = newPeer("invite");
  wire(peer, peer.pc.createDataChannel("cb", { ordered: true }));
  await peer.pc.setLocalDescription(await peer.pc.createOffer());
  await waitIce(peer.pc);
  const code = await pack({ v: 1, g, sdp: peer.pc.localDescription?.sdp });
  return {
    code,
    accept: async (reply: string) => {
      const r = await unpack<{ sdp: string }>(reply);
      await peer.pc.setRemoteDescription({ type: "answer", sdp: r.sdp });
    },
  };
}

/** Step 2 (joiner): scan an invite, get a reply code to show back. */
export async function answerInvite(invite: string): Promise<string> {
  const inv = await unpack<{ v: number; g: string; sdp: string }>(invite);
  if (!inv?.sdp || !inv.g) throw new Error("not an Apex CB invite");
  await setGroup(inv.g);
  const peer = newPeer("join");
  peer.pc.addEventListener("datachannel", (e) => wire(peer, e.channel));
  await peer.pc.setRemoteDescription({ type: "offer", sdp: inv.sdp });
  await peer.pc.setLocalDescription(await peer.pc.createAnswer());
  await waitIce(peer.pc);
  return pack({ sdp: peer.pc.localDescription?.sdp });
}

/* ---- framing + crypto ------------------------------------------------- */

const partial = new Map<string, string[]>();

function wire(peer: Peer, dc: RTCDataChannel) {
  peer.dc = dc;
  dc.onopen = notify;
  dc.onclose = () => {
    peers.delete(peer);
    notify();
  };
  dc.onmessage = async (e) => {
    try {
      const m = JSON.parse(String(e.data)) as { i: string; n: number; t: number; d: string };
      const parts = partial.get(m.i) ?? new Array<string>(m.t);
      parts[m.n] = m.d;
      partial.set(m.i, parts);
      if (parts.filter(Boolean).length < m.t) return;
      partial.delete(m.i);
      const frame = await decrypt(parts.join(""));
      if (frame) deliver(frame, "mesh");
    } catch {
      /* bad frame dropped */
    }
  };
}

async function encrypt(f: LinkFrame): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key!, new TextEncoder().encode(JSON.stringify(f))),
  );
  const all = new Uint8Array(12 + ct.length);
  all.set(iv);
  all.set(ct, 12);
  let bin = "";
  for (let i = 0; i < all.length; i += 8192) bin += String.fromCharCode(...all.subarray(i, i + 8192));
  return btoa(bin);
}

async function decrypt(b64: string): Promise<LinkFrame | null> {
  if (!key) return null;
  const all = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12) }, key, all.slice(12));
    return JSON.parse(new TextDecoder().decode(pt)) as LinkFrame;
  } catch {
    return null; // wrong group — ignore
  }
}

function broadcast(f: LinkFrame) {
  if (!key) return;
  void encrypt(f).then((blob) => {
    const total = Math.ceil(blob.length / CHUNK);
    for (const p of peers) {
      if (p.dc?.readyState !== "open") continue;
      for (let n = 0; n < total; n++) {
        p.dc.send(JSON.stringify({ i: f.id, n, t: total, d: blob.slice(n * CHUNK, (n + 1) * CHUNK) }));
      }
    }
  });
}

export function leaveMesh() {
  peers.forEach((p) => p.pc.close());
  peers.clear();
  notify();
}
