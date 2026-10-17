/**
 * Tri-Star variable-depth spatial addressing — reference implementation.
 *
 * Wire format (docs/TRISTAR_SPATIAL_ROUTING_SPEC.md):
 *   byte 0, bits 0-1: depth flag — 00 = 4-byte coordinate, 01 = 8-byte,
 *                     10 = 12-byte, 11 = reserved / extended vector envelope.
 *   byte 0, bits 2-7: reserved, must be zero on emit, ignored on parse.
 *   bytes 1..N:       the packed ternary coordinate, big-endian.
 *
 * The depth flag is read first by every node, so the coordinate field can
 * widen from 4 to 8 to 12 bytes without a protocol break — the IPv4 -> IPv6
 * trap avoided up front. A node that does not understand a wider field still
 * parses the flag and forwards.
 *
 * Capacity (balanced ternary, 3^k addresses at nesting level k):
 *   level 12 -> 531,441        (~19 bits, fits 4 bytes)
 *   level 14 -> 4,782,969      (~23 bits, fits 4 bytes)
 *   level 18 -> 387,420,489    (~29 bits, fits 8 bytes)
 *   level 36 -> 1.5 x 10^17    (~57 bits, fits 8 bytes)
 *   beyond   -> 12-byte field for hierarchical overflow
 *
 * Coordinates are carried as bigint so the full 12-byte range is exact.
 * This is a reference implementation: no performance figure here is a
 * measured silicon result.
 */

export type TriStarDepth = 0 | 1 | 2;

/** Coordinate field width in bytes for each depth flag. */
export const TRISTAR_DEPTH_BYTES: Record<TriStarDepth, number> = {
  0: 4,
  1: 8,
  2: 12,
};

/** Total header length including the flag byte. */
export function tristarHeaderLength(depth: TriStarDepth): number {
  return 1 + TRISTAR_DEPTH_BYTES[depth];
}

/** Smallest depth that can carry the given coordinate value. */
export function tristarMinDepth(coordinate: bigint): TriStarDepth {
  if (coordinate < 0n) throw new RangeError("coordinate must be non-negative");
  if (coordinate < 1n << 32n) return 0;
  if (coordinate < 1n << 64n) return 1;
  if (coordinate < 1n << 96n) return 2;
  throw new RangeError("coordinate exceeds the 12-byte field");
}

export type TriStarHeader = {
  depth: TriStarDepth;
  coordinate: bigint;
};

/**
 * Pack a header. Emits the smallest depth that carries the coordinate unless
 * the caller pins a wider depth (a sector gateway announcing a wide field).
 */
export function packTriStarHeader(
  coordinate: bigint,
  depth?: TriStarDepth,
): Uint8Array {
  const d = depth ?? tristarMinDepth(coordinate);
  const width = TRISTAR_DEPTH_BYTES[d];
  if (coordinate < 0n || coordinate >= 1n << BigInt(width * 8)) {
    throw new RangeError(`coordinate does not fit depth ${d} (${width} bytes)`);
  }
  const out = new Uint8Array(1 + width);
  out[0] = d; // bits 0-1 = depth; reserved bits stay zero
  let v = coordinate;
  for (let i = width; i >= 1; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/**
 * Parse a header from the front of a packet. Returns the header and the
 * number of bytes consumed, or null when the buffer is too short or the
 * depth flag is the reserved 11 value. Never throws on wire data.
 */
export function parseTriStarHeader(
  packet: Uint8Array,
): (TriStarHeader & { bytes: number }) | null {
  if (packet.length < 1) return null;
  const depth = (packet[0]! & 0x03) as TriStarDepth | 3;
  if (depth === 3) return null; // reserved / extended vector envelope
  const width = TRISTAR_DEPTH_BYTES[depth];
  if (packet.length < 1 + width) return null;
  let coordinate = 0n;
  for (let i = 1; i <= width; i++) {
    coordinate = (coordinate << 8n) | BigInt(packet[i]!);
  }
  return { depth, coordinate, bytes: 1 + width };
}

/**
 * Vector difference between two coordinates at the same depth — the routing
 * plane's only arithmetic. Positive means forward toward higher coordinate
 * space, negative means back, zero means local delivery.
 */
export function tristarVectorDelta(target: bigint, local: bigint): bigint {
  return target - local;
}
