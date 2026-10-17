import { useEffect, useState } from "react";

const KEY = "apex.perfOverlay";
const EVENT = "apex:perf-overlay";

export function loadPerfOverlay(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setPerfOverlay(on: boolean) {
  try {
    if (on) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
}

export function usePerfOverlayEnabled() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(loadPerfOverlay());
    const handler = (e: Event) => setOn((e as CustomEvent<boolean>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return on;
}
