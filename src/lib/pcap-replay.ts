/**
 * libpcap reader — replays a real capture when no phone is attached.
 *
 * Parses the classic pcap global header + per-record headers, then peels
 * Ethernet/RawIP → IPv4/IPv6 → TCP/UDP so the capture can be summarised into
 * flows the same way the live PCAPdroid counters are.
 */

export type Packet = {
  ts: number;
  len: number;
  src: string;
  dst: string;
  proto: string;
  port: number;
};
export type Flow = {
  key: string;
  src: string;
  dst: string;
  proto: string;
  port: number;
  packets: number;
  bytes: number;
  first: number;
  last: number;
};

const MAGIC_LE = 0xd4c3b2a1;
const MAGIC_BE = 0xa1b2c3d4;
const MAGIC_NS_LE = 0x4d3cb2a1;
const MAGIC_NS_BE = 0xa1b23c4d;

const ipv4 = (v: DataView, o: number) =>
  `${v.getUint8(o)}.${v.getUint8(o + 1)}.${v.getUint8(o + 2)}.${v.getUint8(o + 3)}`;

const ipv6 = (v: DataView, o: number) => {
  const parts: string[] = [];
  for (let i = 0; i < 16; i += 2) parts.push(v.getUint16(o + i).toString(16));
  return parts.join(":").replace(/(^|:)(0:)+/, "::");
};

export function parsePcap(buf: ArrayBuffer): Packet[] {
  const v = new DataView(buf);
  if (buf.byteLength < 24) return [];
  const magic = v.getUint32(0, false);
  let little: boolean;
  if (magic === MAGIC_BE || magic === MAGIC_NS_BE) little = false;
  else if (v.getUint32(0, true) === MAGIC_BE || v.getUint32(0, true) === MAGIC_NS_BE) little = true;
  else if (magic === MAGIC_LE || magic === MAGIC_NS_LE) little = true;
  else return [];
  const nanos = (little ? v.getUint32(0, true) : magic) === MAGIC_NS_BE;
  const linkType = v.getUint32(20, little);

  const out: Packet[] = [];
  let off = 24;
  while (off + 16 <= buf.byteLength) {
    const sec = v.getUint32(off, little);
    const frac = v.getUint32(off + 4, little);
    const caplen = v.getUint32(off + 8, little);
    const origlen = v.getUint32(off + 12, little);
    off += 16;
    if (caplen === 0 || off + caplen > buf.byteLength) break;
    const ts = sec * 1000 + frac / (nanos ? 1e6 : 1e3);
    const pkt = decode(v, off, caplen, linkType, ts, origlen);
    if (pkt) out.push(pkt);
    off += caplen;
  }
  return out;
}

function decode(
  v: DataView,
  off: number,
  caplen: number,
  linkType: number,
  ts: number,
  origlen: number,
): Packet | null {
  let p = off;
  // 1 = Ethernet, 101 = raw IP, 113 = Linux cooked
  if (linkType === 1) {
    if (caplen < 14) return null;
    const et = v.getUint16(p + 12);
    p += 14;
    if (et !== 0x0800 && et !== 0x86dd) return null;
  } else if (linkType === 113) {
    if (caplen < 16) return null;
    p += 16;
  }

  const version = v.getUint8(p) >> 4;
  let src: string;
  let dst: string;
  let protoNum: number;
  let hdr: number;
  if (version === 4) {
    hdr = (v.getUint8(p) & 0x0f) * 4;
    protoNum = v.getUint8(p + 9);
    src = ipv4(v, p + 12);
    dst = ipv4(v, p + 16);
  } else if (version === 6) {
    hdr = 40;
    protoNum = v.getUint8(p + 6);
    src = ipv6(v, p + 8);
    dst = ipv6(v, p + 24);
  } else return null;

  let port = 0;
  const t = p + hdr;
  if ((protoNum === 6 || protoNum === 17) && t + 4 <= off + caplen) port = v.getUint16(t + 2);
  const proto =
    protoNum === 6 ? "TCP" : protoNum === 17 ? "UDP" : protoNum === 1 ? "ICMP" : `IP/${protoNum}`;
  return { ts, len: origlen, src, dst, proto, port };
}

export function toFlows(packets: Packet[]): Flow[] {
  const map = new Map<string, Flow>();
  for (const p of packets) {
    const key = `${p.src}>${p.dst}:${p.port}/${p.proto}`;
    const f = map.get(key);
    if (f) {
      f.packets++;
      f.bytes += p.len;
      f.last = p.ts;
    } else {
      map.set(key, {
        key,
        src: p.src,
        dst: p.dst,
        proto: p.proto,
        port: p.port,
        packets: 1,
        bytes: p.len,
        first: p.ts,
        last: p.ts,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.bytes - a.bytes);
}

/** Loads the bundled demo capture shipped with the PWA. */
export async function loadDemoCapture(): Promise<Packet[]> {
  const r = await fetch("/demo.pcap");
  if (!r.ok) throw new Error(`demo capture ${r.status}`);
  return parsePcap(await r.arrayBuffer());
}
