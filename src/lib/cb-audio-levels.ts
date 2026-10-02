import { useEffect, useState } from "react";

/**
 * Radio-owned RX/TX levels, independent of the phone's volume buttons, so a
 * Bluetooth headset at gaming volume isn't blasted by a key-up.
 * rx: playback 0–1. tx: outgoing mic gain 0–1.5.
 */
const KEY = "apex.cb.levels";
export const RX_MAX = 1;
export const TX_MAX = 1.5;
type Levels = { rx: number; tx: number };
const DEFAULT: Levels = { rx: 0.8, tx: 1 };
const subs = new Set<(l: Levels) => void>();

export function readLevels(): Levels {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Levels> | null;
    return {
      rx: Math.min(RX_MAX, Math.max(0, Number(v?.rx ?? DEFAULT.rx))),
      tx: Math.min(TX_MAX, Math.max(0, Number(v?.tx ?? DEFAULT.tx))),
    };
  } catch {
    return DEFAULT;
  }
}

export function setLevel(which: keyof Levels, value: number) {
  const next = { ...readLevels(), [which]: value };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* locked */ }
  subs.forEach((f) => f(next));
}

export function useLevels(): Levels {
  const [l, setL] = useState<Levels>(DEFAULT);
  useEffect(() => {
    setL(readLevels());
    subs.add(setL);
    return () => { subs.delete(setL); };
  }, []);
  return l;
}

/** Play a received clip at the radio's RX level. */
export function playRx(src: string): HTMLAudioElement {
  const a = new Audio(src);
  a.volume = readLevels().rx;
  return a;
}
