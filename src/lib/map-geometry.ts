/**
 * Pure geometry helpers for the signal map overlays.
 *
 * These exist so a map screen is never empty: even with zero access points and
 * no bridge, the mesh grid, spear bearings and stack rings are real geographic
 * geometry projected around the device fix.
 */

export type LatLon = { lat: number; lon: number };

const R = 6_371_000; // metres

/** Offset a point by `metres` along a compass `bearing` (degrees from north). */
export function offset(from: LatLon, metres: number, bearing: number): [number, number] {
  const br = (bearing * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lon1 = (from.lon * Math.PI) / 180;
  const d = metres / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return [(lat2 * 180) / Math.PI, (((lon2 * 180) / Math.PI + 540) % 360) - 180];
}

/** Square grid of lines (a local graticule) centred on the fix. */
export function meshGrid(center: LatLon, span: number, cells: number): [number, number][][] {
  const lines: [number, number][][] = [];
  const half = span / 2;
  for (let i = 0; i <= cells; i++) {
    const t = -half + (span * i) / cells;
    // north-south line at east offset t
    const a = offset(center, t, 90);
    lines.push([
      offset({ lat: a[0], lon: a[1] }, half, 0),
      offset({ lat: a[0], lon: a[1] }, half, 180),
    ]);
    // east-west line at north offset t
    const b = offset(center, t, 0);
    lines.push([
      offset({ lat: b[0], lon: b[1] }, half, 90),
      offset({ lat: b[0], lon: b[1] }, half, 270),
    ]);
  }
  return lines;
}

/** Tetrahedral "spear" bearings — three legs 120° apart plus a nadir tick. */
export function spearLegs(
  center: LatLon,
  reach: number,
  heading = 0,
): { line: [number, number][]; bearing: number }[] {
  return [0, 120, 240].map((b) => {
    const bearing = (b + heading) % 360;
    return {
      bearing,
      line: [[center.lat, center.lon] as [number, number], offset(center, reach, bearing)],
    };
  });
}

/** Range rings for the stack overlay, in metres. */
export function stackRings(base: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => base * (i + 1));
}
