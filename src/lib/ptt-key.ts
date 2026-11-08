/**
 * Hardware push-to-talk key.
 *
 * Rugged Android handsets (Ulefone Armor 22 / X13, Blackview, Sonim) carry a
 * dedicated side key that Android can route to the foreground app as a key
 * event. Which code arrives depends on the handset's key-mapping menu, so the
 * deck listens for the usual suspects and can also learn whatever the phone
 * actually sends.
 *
 * Down keys the transmitter, up releases it — exactly like the paddle.
 *
 * The established assignment (Nov 7, 2026): once the user assigns the key
 * here, the assignment governs. In the native shell the container owns it —
 * MainActivity consumes the key at dispatch level, classifies the gesture
 * (single / double / long) against the bindings stored natively, and no hold
 * of any length can raise a selector. On the plain web build the same model
 * runs in-page: bindings live in localStorage and the timing engine below
 * classifies the keys the page can see.
 */

const KEY = "apex.ptt.hardkey";
const GESTURES_KEY = "apex.ptt.gestures";

/** Codes rugged handsets commonly emit for a side PTT key. */
export const DEFAULT_PTT_CODES = [
  "F24",
  "F23",
  "MediaRecord",
  "MediaPlayPause",
  "AudioVolumeMute",
  "BrowserSearch",
  "LaunchApplication1",
  "LaunchApplication2",
] as const;

/** Legacy numeric keyCodes: 79 = HeadsetHook, 130 = media record on some ROMs. */
const DEFAULT_KEYCODES = [79, 130];

export type LearnedKey = { code: string; keyCode: number };

export function loadLearnedKey(): LearnedKey | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LearnedKey>;
    if (typeof v?.code !== "string") return null;
    return { code: v.code, keyCode: Number(v.keyCode ?? 0) };
  } catch {
    return null;
  }
}

export function saveLearnedKey(k: LearnedKey | null) {
  if (typeof window === "undefined") return;
  try {
    if (k) window.localStorage.setItem(KEY, JSON.stringify(k));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage locked */
  }
}

/** Does this event look like the hardware PTT key? */
export function isPttKey(
  e: Pick<KeyboardEvent, "code" | "keyCode">,
  learned: LearnedKey | null,
): boolean {
  // F24 is what the native shell forwards for the side key; always honour it,
  // even when a learned key exists (the two stores are separate).
  if (e.code === "F24") return true;
  if (learned) return e.code === learned.code || (!!e.keyCode && e.keyCode === learned.keyCode);
  return (
    (DEFAULT_PTT_CODES as readonly string[]).includes(e.code) ||
    DEFAULT_KEYCODES.includes(e.keyCode)
  );
}

/**
 * Bind the hardware key. `onDown` fires once per physical press (auto-repeat
 * suppressed), `onUp` on release. Returns an unbind function.
 */
export function bindPttKey(onDown: () => void, onUp: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  let held = false;
  const down = (e: KeyboardEvent) => {
    if (e.repeat || held) return;
    if (!isPttKey(e, loadLearnedKey())) return;
    e.preventDefault();
    held = true;
    onDown();
  };
  const up = (e: KeyboardEvent) => {
    if (!held) return;
    if (!isPttKey(e, loadLearnedKey())) return;
    e.preventDefault();
    held = false;
    onUp();
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
  };
}

/**
 * Calibration: capture the next key the handset sends and remember it.
 * Resolves with the learned key, or null when cancelled / timed out.
 */
export function learnPttKey(timeoutMs = 10_000): {
  done: Promise<LearnedKey | null>;
  cancel: () => void;
} {
  let settle: (v: LearnedKey | null) => void = () => {};
  const done = new Promise<LearnedKey | null>((r) => (settle = r));
  if (typeof window === "undefined") {
    settle(null);
    return { done, cancel: () => {} };
  }
  const finish = (v: LearnedKey | null) => {
    window.removeEventListener("keydown", grab, true);
    clearTimeout(timer);
    if (v) saveLearnedKey(v);
    settle(v);
  };
  const grab = (e: KeyboardEvent) => {
    if (e.repeat) return;
    // Never steal typing keys during calibration.
    if (e.code.startsWith("Key") || e.code.startsWith("Digit") || e.code === "Escape") {
      if (e.code === "Escape") finish(null);
      return;
    }
    e.preventDefault();
    finish({ code: e.code, keyCode: e.keyCode });
  };
  const timer = setTimeout(() => finish(null), timeoutMs);
  window.addEventListener("keydown", grab, true);
  return { done, cancel: () => finish(null) };
}

/* ------------------------------------------------------------------ */
/* Gestures: single / double / long, separately assignable.            */
/* ------------------------------------------------------------------ */

export type PttGesture = "single" | "double" | "long";

/**
 * What a gesture does. Built-ins: "talk" (key the radio), "open" (bring the
 * talk surface forward), "none". Any other string is the deck's own action
 * name, delivered through the gesture handler untouched.
 */
export type PttBindings = Record<PttGesture, string>;

export const DEFAULT_BINDINGS: PttBindings = { single: "talk", double: "talk", long: "talk" };

/** Shared with MainActivity's engine — keep the numbers in step. */
export const LONG_PRESS_MS = 600;
export const DOUBLE_TAP_MS = 350;

export function loadBindings(): PttBindings {
  if (typeof window === "undefined") return { ...DEFAULT_BINDINGS };
  try {
    const raw = window.localStorage.getItem(GESTURES_KEY);
    if (!raw) return { ...DEFAULT_BINDINGS };
    const v = JSON.parse(raw) as Partial<PttBindings>;
    return {
      single: typeof v.single === "string" ? v.single : "talk",
      double: typeof v.double === "string" ? v.double : "talk",
      long: typeof v.long === "string" ? v.long : "talk",
    };
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

export function saveBinding(gesture: PttGesture, action: string) {
  if (typeof window === "undefined") return;
  try {
    const b = loadBindings();
    b[gesture] = action;
    window.localStorage.setItem(GESTURES_KEY, JSON.stringify(b));
  } catch {
    /* storage locked */
  }
  // In the shell, the container's store is the established copy.
  void nativePttKey().then((p) => p?.setBinding({ gesture, action })).catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Native bridge (Capacitor "PttKey" plugin, native side is the        */
/* MainActivity/PttKeyStore pair). Null on the plain web build.        */
/* ------------------------------------------------------------------ */

type PttKeyPlugin = {
  getState(): Promise<{ assignedKeyCode: number; bindings: PttBindings }>;
  setBinding(o: { gesture: PttGesture; action: string }): Promise<unknown>;
  setAssignedKey(o: { keyCode: number }): Promise<unknown>;
  resetBindings(): Promise<unknown>;
  learnKey(): Promise<void>;
  addListener(
    event: "keyLearned",
    cb: (o: { keyCode: number }) => void,
  ): Promise<{ remove: () => void }>;
};

let nativePlugin: PttKeyPlugin | null | undefined;

export async function nativePttKey(): Promise<PttKeyPlugin | null> {
  if (nativePlugin !== undefined) return nativePlugin;
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    nativePlugin = Capacitor.isNativePlatform()
      ? registerPlugin<PttKeyPlugin>("PttKey")
      : null;
  } catch {
    nativePlugin = null;
  }
  return nativePlugin;
}

/** The container's established state, when running in the shell. */
export async function loadNativeState(): Promise<{
  assignedKeyCode: number;
  bindings: PttBindings;
} | null> {
  const p = await nativePttKey();
  if (!p) return null;
  try {
    return await p.getState();
  } catch {
    return null;
  }
}

/**
 * Learn the PTT key through the container (native capture — works even when
 * the vendor layer never delivers the key to the page). Resolves with the
 * captured Android keyCode, or -1 on timeout. Null on the web build: use
 * learnPttKey there instead.
 */
export async function learnPttKeyNative(timeoutMs = 15_000): Promise<number | null> {
  const p = await nativePttKey();
  if (!p) return null;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: number | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    p.addListener("keyLearned", (o) => {
      clearTimeout(timer);
      finish(o.keyCode >= 0 ? o.keyCode : null);
    }).catch(() => finish(null));
    p.learnKey().catch(() => {
      clearTimeout(timer);
      finish(null);
    });
  });
}

export type PttGestureEvent = { gesture: PttGesture; action: string; keyCode: number };

/**
 * Bind the full gesture model.
 *
 * In the shell, classification is native: this listens for the container's
 * "apex-ptt-gesture" events and routes them, while talk edges arrive as the
 * F24 key events bindPttKey already honours — so talk is never double-keyed.
 * On the web, the timing engine below classifies the keys the page can see:
 * talk keys on the physical down with zero latency, and a hold past
 * LONG_PRESS_MS resolves as the long gesture and stays keyed if its binding
 * is "talk" — no hold of any length raises a menu or a selector from here.
 */
export function bindPttGestures(handlers: {
  onGesture: (e: PttGestureEvent) => void;
}): () => void {
  if (typeof window === "undefined") return () => {};
  let disposed = false;
  let unbindEngine: (() => void) | null = null;

  const onNativeGesture = (e: Event) => {
    const d = (e as CustomEvent<PttGestureEvent>).detail;
    if (d && typeof d.action === "string") handlers.onGesture(d);
  };
  window.addEventListener("apex-ptt-gesture", onNativeGesture);

  void nativePttKey().then((p) => {
    if (disposed || p) return; // shell: native engine classifies; nothing to do
    // Web build: run the timing engine in-page.
    let down = false;
    let longFired = false;
    let secondPress = false;
    let awaitingSingle = false;
    let longTimer: ReturnType<typeof setTimeout> | null = null;
    let singleTimer: ReturnType<typeof setTimeout> | null = null;
    const clear = (t: ReturnType<typeof setTimeout> | null) => {
      if (t) clearTimeout(t);
    };
    const downH = (e: KeyboardEvent) => {
      if (e.repeat || down) return;
      if (!isPttKey(e, loadLearnedKey())) return;
      e.preventDefault();
      down = true;
      longFired = false;
      secondPress = awaitingSingle;
      if (awaitingSingle) {
        clear(singleTimer);
        singleTimer = null;
        awaitingSingle = false;
      }
      longTimer = setTimeout(() => {
        if (!down || longFired) return;
        longFired = true;
        const action = loadBindings().long;
        if (action !== "talk") {
          handlers.onGesture({ gesture: "long", action, keyCode: e.keyCode });
        }
      }, LONG_PRESS_MS);
    };
    const upH = (e: KeyboardEvent) => {
      if (!down) return;
      if (!isPttKey(e, loadLearnedKey())) return;
      e.preventDefault();
      down = false;
      clear(longTimer);
      longTimer = null;
      if (longFired) {
        longFired = false;
        secondPress = false;
        return;
      }
      if (secondPress) {
        secondPress = false;
        const action = loadBindings().double;
        if (action !== "talk") {
          handlers.onGesture({ gesture: "double", action, keyCode: e.keyCode });
        }
        return;
      }
      awaitingSingle = true;
      singleTimer = setTimeout(() => {
        awaitingSingle = false;
        const action = loadBindings().single;
        if (action !== "talk") {
          handlers.onGesture({ gesture: "single", action, keyCode: e.keyCode });
        }
      }, DOUBLE_TAP_MS);
    };
    window.addEventListener("keydown", downH);
    window.addEventListener("keyup", upH);
    unbindEngine = () => {
      window.removeEventListener("keydown", downH);
      window.removeEventListener("keyup", upH);
      clear(longTimer);
      clear(singleTimer);
    };
  });

  return () => {
    disposed = true;
    window.removeEventListener("apex-ptt-gesture", onNativeGesture);
    unbindEngine?.();
  };
}
