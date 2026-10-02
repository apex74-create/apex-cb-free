import { useEffect, useState } from "react";

/**
 * Face render diagnostics + initial-load safety fallback.
 *
 * Two jobs:
 *  1. Diagnostic mode — a live read-out that says which rendering pathway the
 *     device ended up on (accelerated canvas, the same one the phone/tablet
 *     build uses, or the SVG face) so you can confirm the watch reached
 *     *parity* with the phone build after a successful face remount.
 *  2. Safe mode — if the page throws while the face is first coming up, the
 *     canvas layer is disarmed immediately (SVG only), then re-armed
 *     automatically on the next retry window so a one-off boot error does not
 *     permanently downgrade the watch.
 */

export type Pathway = "canvas" | "svg" | "probing";
export type DeviceClass = "watch" | "phone" | "tablet" | "desktop";

export type DiagEntry = { t: number; msg: string };

export type DiagState = {
  /** Pathway currently painting the face. */
  pathway: Pathway;
  /** Pathway the phone/tablet build uses — the parity reference. */
  reference: Pathway;
  /** True once the watch is rendering through the same pathway as the phone. */
  parity: boolean;
  deviceClass: DeviceClass;
  legacy: boolean;
  /** Result of the canvas pixel probe (null before it runs). */
  probe: boolean | null;
  /** Remount attempt index that produced the current pathway. */
  attempt: number;
  /** ms from mount to the first painted canvas frame. */
  firstFrameMs: number | null;
  safeMode: boolean;
  safeReason: string | null;
  /** Rolling event log, newest last. */
  log: DiagEntry[];
};

const DIAG_KEY = "apex.renderDiag";
const SAFE_KEY = "apex.safeMode";
const EVENT = "apex:render-diagnostics";
const MAX_LOG = 40;

export function deviceClass(): DeviceClass {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth || 0;
  const h = window.innerHeight || 0;
  const min = Math.min(w, h);
  const max = Math.max(w, h);
  if (max <= 480 && min <= 480) return "watch";
  if (max <= 900) return "phone";
  if (max <= 1280) return "tablet";
  return "desktop";
}

let state: DiagState = {
  pathway: "probing",
  reference: "canvas",
  parity: false,
  deviceClass: "desktop",
  legacy: false,
  probe: null,
  attempt: 0,
  firstFrameMs: null,
  safeMode: false,
  safeReason: null,
  log: [],
};

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DiagState>(EVENT, { detail: state }));
}

/** Merge a diagnostic update and optionally append a log line. */
export function reportRender(patch: Partial<DiagState>, msg?: string) {
  const next: DiagState = { ...state, ...patch };
  next.parity = next.pathway === next.reference;
  if (msg) {
    next.log = [...state.log, { t: Date.now(), msg }].slice(-MAX_LOG);
  }
  state = next;
  emit();
}

export function getDiagnostics(): DiagState {
  return state;
}

export function isDiagEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DIAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDiagEnabled(on: boolean) {
  try {
    if (on) window.localStorage.setItem(DIAG_KEY, "1");
    else window.localStorage.removeItem(DIAG_KEY);
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new CustomEvent("apex:render-diag-toggle", { detail: on }));
}

export function subscribeDiagnostics(fn: (s: DiagState) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<DiagState>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/* ------------------------------------------------------------------ */
/* Safe mode                                                           */
/* ------------------------------------------------------------------ */

/**
 * Safe mode lives in sessionStorage on purpose: it must survive the current
 * boot (and an immediate reload loop) but never become a permanent downgrade
 * the way `apex.canvas.broken` is.
 */
export function isSafeMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SAFE_KEY) !== null;
  } catch {
    return state.safeMode;
  }
}

export function armSafeMode(reason: string) {
  if (state.safeMode) return;
  try {
    window.sessionStorage.setItem(SAFE_KEY, reason);
  } catch {
    /* storage blocked — in-memory flag still applies */
  }
  reportRender(
    { safeMode: true, safeReason: reason, pathway: "svg" },
    `safe mode armed · ${reason}`,
  );
}

export function clearSafeMode() {
  try {
    window.sessionStorage.removeItem(SAFE_KEY);
  } catch {
    /* ignore */
  }
  if (state.safeMode)
    reportRender({ safeMode: false, safeReason: null }, "safe mode cleared · retrying canvas");
}

/**
 * Watch the initial-load window for uncaught errors. Anything that blows up
 * while the face is first coming up arms safe mode, which drops the canvas
 * layer instantly; the caller then schedules a recovery retry.
 */
export function watchLoadErrors(windowMs: number, onError: (reason: string) => void) {
  if (typeof window === "undefined") return () => {};
  const onErr = (e: ErrorEvent) => {
    onError(`load error: ${(e.message || "unknown").slice(0, 80)}`);
  };
  const onRej = (e: PromiseRejectionEvent) => {
    const r = e.reason;
    onError(`load rejection: ${String(r?.message ?? r ?? "unknown").slice(0, 80)}`);
  };
  window.addEventListener("error", onErr);
  window.addEventListener("unhandledrejection", onRej);
  const off = setTimeout(() => {
    window.removeEventListener("error", onErr);
    window.removeEventListener("unhandledrejection", onRej);
  }, windowMs);
  return () => {
    clearTimeout(off);
    window.removeEventListener("error", onErr);
    window.removeEventListener("unhandledrejection", onRej);
  };
}

/** React binding for the diagnostic overlay / settings panel. */
export function useRenderDiagnostics() {
  const [diag, setDiag] = useState<DiagState>(getDiagnostics);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setDiag(getDiagnostics());
    setEnabled(isDiagEnabled());
    const offDiag = subscribeDiagnostics(setDiag);
    const onToggle = (e: Event) => setEnabled((e as CustomEvent<boolean>).detail);
    window.addEventListener("apex:render-diag-toggle", onToggle);
    return () => {
      offDiag();
      window.removeEventListener("apex:render-diag-toggle", onToggle);
    };
  }, []);
  return { diag, enabled, setEnabled: setDiagEnabled };
}
