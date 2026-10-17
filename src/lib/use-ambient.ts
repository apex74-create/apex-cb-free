import { useCallback, useEffect, useRef, useState } from "react";
import { sampleAmbient, type AmbientSample } from "./ambient";

export type AmbientState = {
  sample: AmbientSample | null;
  scanning: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Repeatedly samples the ambient signal environment. Works with no bridge,
 * no agent and no LAN server — everything comes from the browser itself.
 */
export function useAmbient(intervalMs = 20_000, withFix = true): AmbientState {
  const [sample, setSample] = useState<AmbientSample | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (busy.current) return;
      busy.current = true;
      setScanning(true);
      try {
        const next = await sampleAmbient({ fix: withFix });
        if (!cancelled) {
          setSample(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "ambient scan failed");
      } finally {
        busy.current = false;
        if (!cancelled) setScanning(false);
      }
    };

    void run();
    const timer = intervalMs > 0 ? setInterval(run, intervalMs) : null;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [intervalMs, withFix, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { sample, scanning, error, refresh };
}
