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
 */

const KEY = "apex.ptt.hardkey";

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
