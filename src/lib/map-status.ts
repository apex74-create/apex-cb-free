/**
 * Tiny module-level store so the diagnostics panel can report what the map
 * layer is actually doing (real render state, not a guess).
 */
export type MapStatus = {
  tool: string | null;
  ready: boolean;
  tilesLoaded: number;
  tileErrors: number;
  width: number;
  height: number;
  markers: number;
  fix: boolean;
  at: number | null;
};

const initial: MapStatus = {
  tool: null,
  ready: false,
  tilesLoaded: 0,
  tileErrors: 0,
  width: 0,
  height: 0,
  markers: 0,
  fix: false,
  at: null,
};

let current: MapStatus = initial;
const listeners = new Set<() => void>();

export function reportMap(patch: Partial<MapStatus>) {
  current = { ...current, ...patch, at: Date.now() };
  listeners.forEach((fn) => fn());
}

export function resetMap() {
  current = { ...initial };
  listeners.forEach((fn) => fn());
}

export function getMapStatus(): MapStatus {
  return current;
}

export function subscribeMap(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
