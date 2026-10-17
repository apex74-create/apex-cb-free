/**
 * Shared live state for the real Reticulum node running on the paired phone.
 *
 * The bridge page runs the attach sequence (rnsd -> listener -> announce ->
 * rnstatus/rnpath read-back) and publishes the parsed result here so netchat
 * and radar can tell "no bridge" apart from "bridge up, mesh node live".
 * Nothing here is synthesised — every field comes from real tool output.
 */

export type MeshStatus = {
  /** rnsd process seen in `ps` on the phone. */
  up: boolean;
  /** LXMF destination hash from the netchat helper, when known. */
  identity: string | null;
  /** Interfaces reported by `rnstatus -A`. */
  ifaces: number;
  /** Known paths from `rnpath -t`. */
  paths: boolean;
  pathCount: number;
  /** Listener spooling LXMF into the inbox. */
  listening: boolean;
  /** Epoch ms of the last successful read. */
  at: number;
  note: string;
};

const KEY = "apex.mesh.status";

const EMPTY: MeshStatus = {
  up: false,
  identity: null,
  ifaces: 0,
  paths: false,
  pathCount: 0,
  listening: false,
  at: 0,
  note: "",
};

let current: MeshStatus = EMPTY;
let hydrated = false;
const subs = new Set<(s: MeshStatus) => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) current = { ...EMPTY, ...(JSON.parse(raw) as Partial<MeshStatus>) };
  } catch {
    /* session storage unavailable on locked-down watch webviews */
  }
}

export function getMeshStatus(): MeshStatus {
  hydrate();
  return current;
}

export function setMeshStatus(patch: Partial<MeshStatus>) {
  hydrate();
  current = { ...current, ...patch };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* non-fatal */
  }
  for (const fn of subs) fn(current);
}

export function subscribeMesh(fn: (s: MeshStatus) => void): () => void {
  hydrate();
  subs.add(fn);
  fn(current);
  return () => subs.delete(fn);
}

/** A node is usable for chat/radar traffic once rnsd is up with an interface. */
export const meshLive = (s: MeshStatus) => s.up && s.ifaces > 0;
