/** Recipient-bound invitations on the current room's digital carriers. */
import { supabase } from "@/integrations/supabase/client";
import { onLinkFrame, sendAll, type LinkFrame } from "@/lib/cb-links";
import { decryptBody, encryptBody, roomBusName, roomCode, childRoomId, loadRooms, type Room } from "@/lib/rooms";

const STORE = "apex.cb.invite-identity.v1";
const PREFIX = "INV1:";
type Identity = { id: string; publicKey: JsonWebKey; privateKey: JsonWebKey };
type Announcement = { t: "hello"; id: string; call: string; pub: JsonWebKey };
type Sealed = { t: "request" | "accept" | "decline"; id: string; to: string; pub: JsonWebKey; body: string };
type Wire = Announcement | Sealed;
export type InvitePeer = { id: string; call: string; pub: JsonWebKey };
export type IncomingInvite = { id: string; peerId: string; from: string; fingerprint: string; room: Room };

function validPublic(pub: JsonWebKey) {
  return pub.kty === "EC" && pub.crv === "P-256" && typeof pub.x === "string" && typeof pub.y === "string";
}
async function identity(): Promise<Identity> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null") as Identity | null;
    if (saved?.id && saved.privateKey && validPublic(saved.publicKey)) return saved;
  } catch { /* disabled storage */ }
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const value = {
    id: crypto.randomUUID(),
    publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey),
    privateKey: await crypto.subtle.exportKey("jwk", pair.privateKey),
  };
  try { localStorage.setItem(STORE, JSON.stringify(value)); } catch { /* session-only identity */ }
  return value;
}

async function sharedKey(privateKey: JsonWebKey, publicKey: JsonWebKey): Promise<CryptoKey> {
  const mine = await crypto.subtle.importKey("jwk", privateKey, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
  const theirs = await crypto.subtle.importKey("jwk", publicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  return crypto.subtle.deriveKey({ name: "ECDH", public: theirs }, mine, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export function peerFingerprint(pub: JsonWebKey) {
  return `${String(pub.x ?? "").slice(0, 6)}·${String(pub.y ?? "").slice(0, 6)}`;
}

/** Returns an independent invitation listener; never puts the invite code in an open message. */
export function listenInvites(roomId: string, call: string, onPeers: (peers: InvitePeer[]) => void, onInvite: (invite: IncomingInvite) => void, onAccepted: (room: Room) => void) {
  let active = true;
  const peers = new Map<string, InvitePeer>();
  const seen = new Set<string>();
  const ready = identity();
  const channel = supabase.channel(`invite-${roomBusName(roomId)}`, { config: { broadcast: { self: false } } });
  const send = async (wire: Wire) => {
    const frame: LinkFrame = { id: crypto.randomUUID(), ch: Number(roomId.split(".")[0]), roomId, from: call, kind: "text", body: PREFIX + JSON.stringify(wire), ts: Date.now(), digitalOnly: true };
    sendAll(frame);
    const status = await channel.send({ type: "broadcast", event: "invite", payload: frame });
    if (status !== "ok" && status !== "timed out") throw new Error("Relay unavailable");
  };
  const receive = async (frame: Partial<LinkFrame>) => {
    if (!active || frame.roomId !== roomId || !frame.body?.startsWith(PREFIX) || !frame.id || seen.has(frame.id)) return;
    seen.add(frame.id);
    if (seen.size > 500) seen.clear();
    try {
      const wire = JSON.parse(frame.body.slice(PREFIX.length)) as Wire;
      if (!validPublic(wire.pub)) return;
      const me = await ready;
      if (!active || wire.id === me.id) return;
      if (wire.t === "hello") {
        peers.set(wire.id, { id: wire.id, call: wire.call.slice(0, 12), pub: wire.pub });
        onPeers([...peers.values()]);
      } else if (wire.to === me.id) {
        const sender = peers.get(wire.id);
        if (!sender || JSON.stringify(sender.pub) !== JSON.stringify(wire.pub)) return;
        const clear = await decryptBody(await sharedKey(me.privateKey, sender.pub), wire.body);
        if (!clear || !active) return;
        const room = JSON.parse(clear) as Room;
        if (!room.code || !room.id.startsWith(`${roomId}.`) || !/^[0-9A-Za-z]{12,16}$/.test(room.code)) return;
        if (wire.t === "request") onInvite({ id: frame.id, peerId: sender.id, from: sender.call, fingerprint: peerFingerprint(sender.pub), room });
        if (wire.t === "accept") onAccepted(room);
      }
    } catch { /* invalid or unreadable invite */ }
  };
  channel.on("broadcast", { event: "invite" }, ({ payload }) => void receive(payload as LinkFrame));
  channel.subscribe();
  const off = onLinkFrame((frame) => void receive(frame));
  const announce = () => void ready.then((me) => { if (active) void send({ t: "hello", id: me.id, call, pub: me.publicKey }).catch(() => {}); });
  const first = setTimeout(announce, 600);
  const timer = setInterval(announce, 12_000);
  return {
    async request(peer: InvitePeer) {
      const me = await ready;
      const id = childRoomId(roomId, loadRooms().map((r) => r.id));
      const room: Room = { id, channel: Number(roomId.split(".")[0]), label: `ROOM ${id}`, code: roomCode() };
      const body = await encryptBody(await sharedKey(me.privateKey, peer.pub), JSON.stringify(room));
      await send({ t: "request", id: me.id, to: peer.id, pub: me.publicKey, body });
      return room;
    },
    async respond(invite: IncomingInvite, accepted: boolean) {
      const me = await ready;
      const peer = peers.get(invite.peerId);
      if (!peer) return;
      const body = await encryptBody(await sharedKey(me.privateKey, peer.pub), JSON.stringify(invite.room));
      await send({ t: accepted ? "accept" : "decline", id: me.id, to: peer.id, pub: me.publicKey, body });
    },
    close() {
      active = false;
      clearTimeout(first);
      clearInterval(timer);
      off();
      void supabase.removeChannel(channel);
    },
  };
}