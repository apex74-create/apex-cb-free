/**
 * Local-only bridge between the wide connection map and the close-up handset
 * map. Holds the current room's fresh peers and the home anchor; nothing here
 * is transmitted. Switching rooms replaces the peer set so private rooms never mix.
 */
import type { SquadPeer } from "@/lib/squad-positions";

export type LocalMapView = { roomId: string; home: [number, number] | null; peers: SquadPeer[] };

const HOME_KEY = "apex.cb.home-anchor.v1";
/** Close-up map radius: people at the house / around the access point. */
export const MICRO_RADIUS_M = 250;

let view: LocalMapView = { roomId: "", home: null, peers: [] };
const listeners = new Set<() => void>();

export function readHome(): [number, number] | null {
  try {
    const v = JSON.parse(localStorage.getItem(HOME_KEY) ?? "null");
    return Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) ? [v[0], v[1]] : null;
  } catch { return null; }
}
export function saveHome(home: [number, number] | null) {
  try { home ? localStorage.setItem(HOME_KEY, JSON.stringify(home)) : localStorage.removeItem(HOME_KEY); } catch { /* storage locked */ }
}

export function publishLocalView(next: LocalMapView) {
  view = next;
  listeners.forEach((fn) => fn());
}
export const getLocalView = () => view;
export function subscribeLocalView(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
