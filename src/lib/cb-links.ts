/**
 * Community shell stub — local link bus.
 *
 * The production build fans each transmission out to every live local
 * carrier (field mesh, USB serial radio, BLE bridge) with dedupe and
 * daisy-chain relay, so a key-up reaches peers with or without internet.
 * That handset-to-handset chain is licensed technology and is NOT included
 * in this community shell. This stub keeps the public interface so the
 * deck compiles; no local carriers can be registered here.
 *
 * The cloud relay carrier (used by the PTT deck) is unaffected.
 *
 * Licence: see LICENSE — commercial use of the chain requires a licence
 * and revenue share. API access: https://tinyradr.com
 */
import { useSyncExternalStore } from "react";

export type LinkFrame = {
  id: string;
  ch: number;
  from: string;
  kind: "voice" | "text";
  body: string;
  ts: number;
  hops?: number;
  roomId?: string;
  digitalOnly?: boolean;
};

export type LinkKind = "mesh" | "usb";

type Link = {
  kind: LinkKind;
  send: (f: LinkFrame) => void;
  carriesVoice: boolean;
};

const rxHandlers = new Set<(f: LinkFrame) => void>();
const seen = new Set<string>();
const subs = new Set<() => void>();
const snapshot: LinkKind[] = [];

/** Licensed in the production build — no-op here. */
export function registerLink(_l: Link) {
  /* community shell: local carriers are a licensed feature */
}

export function unregisterLink(_kind: LinkKind) {
  /* community shell: no-op */
}

/** Dedupe + dispatch still work so the deck's receive path is intact. */
export function deliver(f: LinkFrame, _via: LinkKind) {
  if (seen.has(f.id)) return;
  seen.add(f.id);
  if (seen.size > 2000) seen.clear();
  rxHandlers.forEach((h) => h(f));
}

/** Licensed in the production build — no local carriers to fan out to. */
export function sendAll(f: LinkFrame) {
  seen.add(f.id);
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
