/**
 * Community shell stub — squad position sharing.
 *
 * The production build shares crew positions over the room bus (encrypted
 * with the room key) so the map can plot the squad. That capability is
 * licensed technology and is NOT included in this community shell.
 * See LICENSE; API access: https://tinyradr.com
 */

export type SquadPeer = {
  id: string;
  call: string;
  lat: number;
  lon: number;
  ts: number;
};

export const WIFI_REACH_M = 100;
export const PEER_STALE_MS = 60_000;

/** Haversine distance in metres — plain geometry, kept for the map. */
export function distanceM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function joinSquad(
  _roomId: string,
  _call: string,
  _onPeers: (peers: SquadPeer[]) => void,
): () => void {
  return () => {};
}
