import { useEffect } from "react";
import { applySettings, loadSettings, onSettingsChange } from "@/lib/watch-settings";
import { deviceKind, flushQueue } from "@/lib/cloud";
import { applyFaceMetrics, lockWatchFaceMetrics, watchFaceMetrics } from "@/lib/face-metrics";

/**
 * Applies the stored watch display settings on every route. Deliberately
 * state-free: it only writes CSS variables, so changing settings elsewhere
 * never re-renders the whole app.
 */
export default function SettingsBoot() {
  useEffect(() => {
    // Measure the real face first so applySettings can fold the user scale
    // into the auto scale, then keep it live for rotation / late layout.
    const lockedWatch = lockWatchFaceMetrics();
    if (!lockedWatch) applyFaceMetrics();
    applySettings(loadSettings());
    const stopMetrics = lockedWatch
      ? () => {}
      : watchFaceMetrics(() => applySettings(loadSettings()));
    // Tag the form factor so watch / phone / tablet can specialise in CSS.
    const tag = () => {
      if (!lockedWatch) document.documentElement.dataset["device"] = deviceKind();
    };
    tag();
    if (!lockedWatch) window.addEventListener("resize", tag);
    // Anything captured while offline goes up as soon as the link returns.
    const drain = () => void flushQueue();
    drain();
    window.addEventListener("online", drain);
    const off = onSettingsChange(applySettings);
    return () => {
      if (!lockedWatch) window.removeEventListener("resize", tag);
      window.removeEventListener("online", drain);
      stopMetrics();
      off();
    };
  }, []);
  return null;
}
