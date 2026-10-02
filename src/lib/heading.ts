import { useEffect, useState } from "react";

/**
 * One heading source for every dial in the app.
 *
 * Cheap Android watches (Lokmat and friends) ship no magnetometer at all, so
 * `deviceorientation` either never fires or reports a drifting gyro yaw with
 * `absolute === false`. Rather than leaving the needle frozen at north, we
 * fall back to course-over-ground from GPS: once the wearer is moving faster
 * than a slow walk, the direction of travel is a true bearing.
 *
 * source:
 *  - "magnetometer" — absolute compass heading from the panel
 *  - "gyro"         — relative yaw only, drifts, no true north
 *  - "gps"          — course over ground while moving
 *  - "none"         — nothing available; dial should say so
 */
export type HeadingSource = "magnetometer" | "gyro" | "gps" | "none";

export type HeadingReading = {
  /** Degrees clockwise from north, or null when nothing is known. */
  heading: number | null;
  source: HeadingSource;
  /** True when the device reports no absolute compass at all. */
  magnetometer: boolean;
};

const norm = (deg: number) => ((deg % 360) + 360) % 360;

export function useHeading(): HeadingReading {
  const [state, setState] = useState<HeadingReading>({
    heading: null,
    source: "none",
    magnetometer: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let dead = false;
    let sawAbsolute = false;
    let gpsWatch: number | null = null;
    let throttle = 0;

    const push = (heading: number | null, source: HeadingSource, mag: boolean) => {
      if (dead) return;
      const now = Date.now();
      if (now - throttle < 100) return;
      throttle = now;
      setState((prev) =>
        prev.heading === heading && prev.source === source && prev.magnetometer === mag
          ? prev
          : { heading, source, magnetometer: mag },
      );
    };

    const onOrientation = (e: DeviceOrientationEvent) => {
      const webkit = (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      if (typeof webkit === "number" && Number.isFinite(webkit)) {
        sawAbsolute = true;
        push(norm(webkit), "magnetometer", true);
        return;
      }
      if (typeof e.alpha !== "number" || !Number.isFinite(e.alpha)) return;
      if (e.absolute) {
        sawAbsolute = true;
        push(norm(360 - e.alpha), "magnetometer", true);
        return;
      }
      // Relative yaw: useful for the dial spinning with the wrist, but it is
      // not north. Only publish it while no better source exists.
      if (!sawAbsolute) push(norm(360 - e.alpha), "gyro", false);
    };

    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener);
    window.addEventListener("deviceorientation", onOrientation);

    // No absolute fix after a few seconds: this panel has no compass. Ask the
    // position feed for course over ground instead.
    const fallback = window.setTimeout(() => {
      if (dead || sawAbsolute || !navigator.geolocation) return;
      gpsWatch = navigator.geolocation.watchPosition(
        (pos) => {
          const { heading, speed } = pos.coords;
          if (typeof heading === "number" && Number.isFinite(heading) && (speed ?? 0) > 0.6) {
            push(norm(heading), "gps", false);
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
      );
    }, 3500);

    return () => {
      dead = true;
      window.clearTimeout(fallback);
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener);
      window.removeEventListener("deviceorientation", onOrientation);
      if (gpsWatch !== null) navigator.geolocation.clearWatch(gpsWatch);
    };
  }, []);

  return state;
}

/** Plain-English label for whichever source is driving the needle. */
export function headingLabel(source: HeadingSource): string {
  switch (source) {
    case "magnetometer":
      return "magnetic north";
    case "gyro":
      return "gyro yaw · no compass in this watch";
    case "gps":
      return "course over ground · walk to update";
    default:
      return "no compass in this watch";
  }
}
