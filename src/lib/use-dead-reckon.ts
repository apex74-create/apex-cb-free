/**
 * One position feed for the field: satellites when they are there, footsteps
 * when they are not.
 *
 * Feeds every accepted GPS fix into the dead reckoner and every footfall into
 * the same estimate, so the marker keeps walking under canopy. Heading comes
 * from the shared compass hook, so a panel with no magnetometer still uses its
 * last course over ground rather than freezing.
 */
import { useEffect, useRef, useState } from "react";
import { useHeading } from "@/lib/heading";
import {
  createDeadReckoner,
  createStepDetector,
  requestMotionAccess,
  type DeadReckonState,
} from "@/lib/dead-reckoning";

export type FieldPosition = DeadReckonState & {
  /** Age of the last trusted fix, ms. */
  fixAgeMs: number;
  headingDeg: number | null;
  /** No browser fix has arrived until this is nonzero. The initial map seed is not a fix. */
  lastFixAt: number;
};

export function useDeadReckon(enabled: boolean, seed: [number, number]): FieldPosition | null {
  const { heading } = useHeading();
  const headRef = useRef<number | null>(null);
  headRef.current = heading;

  const [state, setState] = useState<FieldPosition | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let dead = false;
    const dr = createDeadReckoner();
    const det = createStepDetector();
    let lastFixAt = 0;
    let lastCourse: number | null = null;

    const publish = () => {
      if (dead) return;
      const s = dr.state();
      if (!s) return;
      setState({ ...s, fixAgeMs: lastFixAt ? Date.now() - lastFixAt : 0, headingDeg: headRef.current, lastFixAt });
    };

    const onFix = (p: GeolocationPosition) => {
      lastFixAt = Date.now();
      if (typeof p.coords.heading === "number" && Number.isFinite(p.coords.heading)) {
        lastCourse = p.coords.heading;
      }
      dr.fix(p.coords.latitude, p.coords.longitude, p.coords.accuracy || 50, lastFixAt);
      publish();
    };

    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      const step = det.push(mag, Date.now());
      if (!step) return;
      dr.step(step.stride, headRef.current ?? lastCourse);
      publish();
    };

    // Seed immediately so the pin exists before the first fix lands.
    dr.fix(seed[0], seed[1], 2000, Date.now());
    publish();

    void requestMotionAccess().then((ok) => {
      if (ok && !dead) window.addEventListener("devicemotion", onMotion);
    });

    const wid = navigator.geolocation?.watchPosition(onFix, () => undefined, {
      enableHighAccuracy: true,
      maximumAge: 5000,
    });
    navigator.geolocation?.getCurrentPosition(onFix, () => undefined, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 300000,
    });
    const t = window.setInterval(publish, 2000);

    return () => {
      dead = true;
      window.clearInterval(t);
      window.removeEventListener("devicemotion", onMotion);
      if (wid !== undefined) navigator.geolocation.clearWatch(wid);
    };
    // seed is only an initial value; changing it should not restart the feed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return state;
}
