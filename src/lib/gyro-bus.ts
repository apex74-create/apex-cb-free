/**
 * Shared attitude bus.
 *
 * The superposition gyro widget owns the live attitude (sensor + drag inertia).
 * The face wallpaper reads it so the circuit substrate and the compass bend to
 * the same angle of attack. Plain module state, no React: the face renders on
 * its own rAF loop and must stay independent of every other face feature —
 * when no gyro is mounted the values simply stay at rest.
 */
export type Attitude = { yaw: number; pitch: number; roll: number };

const attitude: Attitude = { yaw: 0, pitch: 0.4, roll: 0 };

/** Widget centre in viewport px, so the substrate can triangulate onto it. */
let anchor: { x: number; y: number } | null = null;
let lastPublish = 0;

export function publishAttitude(a: Attitude, center?: { x: number; y: number }) {
  attitude.yaw = a.yaw;
  attitude.pitch = a.pitch;
  attitude.roll = a.roll;
  if (center) anchor = center;
  lastPublish = performance.now();
}

export function getAttitude(): Attitude {
  return attitude;
}

/** Null when no gyro widget has published recently (face runs standalone). */
export function getAnchor(): { x: number; y: number } | null {
  if (!anchor || performance.now() - lastPublish > 1500) return null;
  return anchor;
}

export function clearAttitude() {
  anchor = null;
}
