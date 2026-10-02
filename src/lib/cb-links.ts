/**
 * Local link bus for the CB deck — every non-cloud carrier (field mesh,
 * USB cable) registers here. The PTT deck fans each transmission out to all
 * live links and receives from all of them, so a key-up reaches peers over
 * whatever path exists, with or without internet.
 *
 * Legal line: CB radio (Part 95) forbids coded/encrypted messages, so the
 * over-the-air CB path stays in the clear. Encryption lives only on the
 * digital links (Wi-Fi mesh, USB, Bluetooth), which are not CB transmissions.
 */
import { useSyncExternalStore } from "react";

export type LinkFrame = {
  id: string;
  ch: number;
  from: string;
  kind: "voice" | "text";
  body: string;
  ts: number;
  /** relay hops travelled so far — incremented on every daisy-chain pass */
  hops?: number;
  /** Exact digital room; channel number alone cannot distinguish subrooms. */
  roomId?: string;
  /** Never pass through a physical CB transmitter. */
  digitalOnly?: boolean;
};

export type LinkKind = "mesh" | "usb";

type Link = {
  kind: LinkKind;
  send: (f: LinkFrame) => void;
  /** voice clips are too large for serial radios */
  carriesVoice: boolean;
};

const links = new Map<LinkKind, Link>();
const rxHandlers = new Set<(f: LinkFrame) => void>();
const seen = new Set<string>();
const subs = new Set<() => void>();
let snapshot: LinkKind[] = [];

function emit() {
  snapshot = [...links.keys()];
  subs.forEach((s) => s());
}

export function registerLink(l: Link) {
  links.set(l.kind, l);
  emit();
}

export function unregisterLink(kind: LinkKind) {
  links.delete(kind);
  emit();
}

/** Called by a link when a frame arrives. Deduped across all links. */
export function deliver(f: LinkFrame, via: LinkKind) {
  if (seen.has(f.id)) return;
  seen.add(f.id);
  if (seen.size > 2000) seen.clear();
  rxHandlers.forEach((h) => h(f));
  // Daisy-chain: relay onward over the other links, one hop further out.
  const onward = { ...f, hops: (f.hops ?? 0) + 1 };
  links.forEach((l) => {
    if (l.kind !== via && !(f.digitalOnly && l.kind === "usb") && (f.kind === "text" || l.carriesVoice)) l.send(onward);
  });
}

export function sendAll(f: LinkFrame) {
  seen.add(f.id);
  links.forEach((l) => {
    if (!(f.digitalOnly && l.kind === "usb") && (f.kind === "text" || l.carriesVoice)) l.send(f);
  });
}

export function onLinkFrame(h: (f: LinkFrame) => void): () => void {
  rxHandlers.add(h);
  return () => rxHandlers.delete(h);
}

export function activeLinks(): LinkKind[] {
  return snapshot;
}

export function useActiveLinks(): LinkKind[] {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => snapshot,
    () => snapshot,
  );
}
