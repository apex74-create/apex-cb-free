import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Watch display + autonomy settings.
 *
 * These live entirely on the watch (localStorage) so the device keeps its
 * own layout and operating mode with no phone attached.
 */
export type Autonomy = "standalone" | "auto" | "paired";

export type WatchSettings = {
  /** UI scale factor applied to the whole app (text + spacing). */
  scale: number;
  /** Safe-area inset as a percentage of the face, for thick/round bezels. */
  inset: number;
  /** Extra vertical breathing room so tall glyphs never clip. */
  lineHeight: number;
  /** Where tools are allowed to get data from. */
  autonomy: Autonomy;
};

export const DEFAULT_SETTINGS: WatchSettings = {
  scale: 1,
  inset: 0,
  lineHeight: 1.25,
  autonomy: "auto",
};

export const SCALE_RANGE = { min: 0.8, max: 1.5, step: 0.05 };
export const INSET_RANGE = { min: 0, max: 18, step: 1 };
export const LINE_RANGE = { min: 1, max: 1.7, step: 0.05 };

const KEY = "apex.watchSettings";
const EVENT = "apex:watch-settings";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function loadSettings(): WatchSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<WatchSettings>;
    const autonomy: Autonomy =
      parsed.autonomy === "standalone" || parsed.autonomy === "paired" ? parsed.autonomy : "auto";
    return {
      scale: clamp(Number(parsed.scale) || 1, SCALE_RANGE.min, SCALE_RANGE.max),
      inset: clamp(Number(parsed.inset) || 0, INSET_RANGE.min, INSET_RANGE.max),
      lineHeight: clamp(Number(parsed.lineHeight) || 1.25, LINE_RANGE.min, LINE_RANGE.max),
      autonomy,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next: WatchSettings) {
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

/** Push the settings into CSS custom properties consumed by the layout. */
export function applySettings(s: WatchSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--watch-scale", String(s.scale));
  // Multiply the user's scale into the measured auto scale so the same
  // preference reads identically on a 360, 400 or 466 px face.
  const auto = parseFloat(getComputedStyle(root).getPropertyValue("--face-auto")) || 1;
  root.style.setProperty("--ui-scale", String(Math.round(auto * s.scale * 1000) / 1000));
  root.style.setProperty("--watch-line", String(s.lineHeight));
  // Only override the face inset when the user has dialled one in; 0 keeps
  // the shape-driven default (round faces still get their circular margin).
  if (s.inset > 0) root.style.setProperty("--face-inset-user", `${s.inset}%`);
  else root.style.removeProperty("--face-inset-user");
  // Micro calibration written by the plain-HTML boot page: a per-device face
  // pitch (nominally 400 px, dialled in ±1 px at a time) so the square stage
  // lands exactly on the physical face.
  try {
    const px = Number(window.localStorage.getItem("apex.facePx"));
    if (Number.isFinite(px) && px >= 240 && px <= 720) {
      root.style.setProperty("--face-min", `${Math.round(px)}px`);
    } else {
      root.style.removeProperty("--face-min");
    }
  } catch {
    /* storage blocked — keep the stylesheet default */
  }
  root.dataset["autonomy"] = s.autonomy;
}

/** Read the current autonomy mode outside React (bridge client uses this). */
export function currentAutonomy(): Autonomy {
  return loadSettings().autonomy;
}

export function onSettingsChange(fn: (s: WatchSettings) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<WatchSettings>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

export function useWatchSettings() {
  const [settings, setSettings] = useState<WatchSettings>(DEFAULT_SETTINGS);
  const ref = useRef<WatchSettings>(DEFAULT_SETTINGS);
  ref.current = settings;

  useEffect(() => {
    const initial = loadSettings();
    ref.current = initial;
    setSettings(initial);
    applySettings(initial);
    return onSettingsChange((next) => {
      ref.current = next;
      setSettings(next);
    });
  }, []);

  // Side effects stay outside the state updater: broadcasting from inside it
  // would set state on other subscribers mid-render.
  const commit = useCallback((next: WatchSettings) => {
    ref.current = next;
    setSettings(next);
    applySettings(next);
    saveSettings(next);
  }, []);

  const update = useCallback(
    <K extends keyof WatchSettings>(key: K, value: WatchSettings[K]) => {
      commit({ ...ref.current, [key]: value });
    },
    [commit],
  );

  const reset = useCallback(() => {
    commit(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }, [commit]);

  return { settings, update, reset };
}
