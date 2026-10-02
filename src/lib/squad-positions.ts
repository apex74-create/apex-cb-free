/**
 * Squad positions — each handset on a room shares its estimated spot so the
 * map can draw teammates, their Wi-Fi reach rings and link lines.
 *
 * Opt-in only. Positions are sealed with AES-256-GCM before they leave the
 * phone: a private room uses its invite key; an open room uses a key derived
 * from the room id (keeps it off the wire in plain text, but anyone tuned to
 * the same open room can read it — use a locked room for real secrecy).
 */
import { supabase } from "@/integrations/supabase/client";
import { deriveRoomKey, encryptBody, decryptBody, roomBusName } from "@/lib/rooms";
import { onLinkFrame, sendAll } from "@/lib/cb-links";

export type SquadPeer = { id: string; from: string; lat: number; lon: number; acc: number; at: number; source: "browser" | "manual" };

const ID_KEY = "apex.cb.squad-device.v1";
function deviceId() {
  try {
    const saved = localStorage.getItem(ID_KEY);
    if (saved) return saved;
    const created = crypto.randomUUID();
    localStorage.setItem(ID_KEY, created);
    return created;
  } catch { return crypto.randomUUID(); }
}

/** Estimated usable Wi-Fi reach for a handset hotspot in open field, metres. */
export const WIFI_REACH_M = 90;
export const PEER_STALE_MS = 2 * 60_000;

export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function joinSquad(
  roomId: string,
  roomKey: CryptoKey | null,
  me: string,
  onPeer: (p: SquadPeer) => void,
  onStatus?: (status: string) => void,
) {
  const id = deviceId();
  let active = true;
  const keyP = roomKey ? Promise.resolve(roomKey) : deriveRoomKey(`open:${roomId}`);
  const ch = supabase.channel(`pos-${roomBusName(roomId)}`, {
    config: { broadcast: { self: false } },
  });
  const receive = async (cipher: string) => {
    const body = await decryptBody(await keyP, cipher);
    if (!body) return;
    try {
      const p = JSON.parse(body) as SquadPeer;
      if (active && p.id !== id && p.at <= Date.now() + 30_000 && Date.now() - p.at < PEER_STALE_MS && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180 && Number.isFinite(p.acc) && p.acc >= 0) onPeer(p);
    } catch {
      /* malformed */
    }
  };
  ch.on("broadcast", { event: "pos" }, ({ payload }) => void receive(String(payload?.b ?? "")));
  ch.subscribe((s) => { if (active) onStatus?.(s === "SUBSCRIBED" ? "relay connected" : s === "CHANNEL_ERROR" || s === "TIMED_OUT" ? "relay unavailable · local links only" : "connecting"); });
  const offLink = onLinkFrame((frame) => {
    if (frame.digitalOnly && frame.roomId === roomId && frame.body.startsWith("POS1:")) void receive(frame.body.slice(5));
  });
  return {
    async send(lat: number, lon: number, acc: number, source: "browser" | "manual") {
      if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180 || !Number.isFinite(acc) || acc < 0) return;
      const b = await encryptBody(
        await keyP,
        JSON.stringify({ id, from: me, lat, lon, acc, at: Date.now(), source }),
      );
      if (!active) return;
      sendAll({ id: crypto.randomUUID(), ch: Number(roomId.split(".")[0]), roomId, from: me, kind: "text", body: `POS1:${b}`, ts: Date.now(), digitalOnly: true });
      void ch.send({ type: "broadcast", event: "pos", payload: { b } });
    },
    leave() {
      active = false;
      offLink();
      void supabase.removeChannel(ch);
    },
  };
}
