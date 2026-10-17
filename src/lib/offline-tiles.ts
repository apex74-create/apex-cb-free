/**
 * Regional offline tile cache.
 *
 * The Shield pre-caches only the light street basemap for the user's own
 * region (United States or Europe) at low zoom levels — enough for the map
 * to open and orient offline, never a worldwide tile dump. Satellite
 * imagery is excluded on purpose: it is far too heavy for a field cache.
 *
 * Region is inferred from the device timezone; the user can override it.
 */

export type TileRegion = "us" | "europe";

export const TILE_CACHE = "apex-shield-tiles-v1";

const REGIONS: Record<TileRegion, { label: string; minLat: number; maxLat: number; minLon: number; maxLon: number }> = {
  us: { label: "United States", minLat: 24, maxLat: 50, minLon: -125, maxLon: -66 },
  europe: { label: "Europe", minLat: 35, maxLat: 71, minLon: -11, maxLon: 32 },
};

/** Zoom levels cached. z6 keeps the whole region under ~120 tiles. */
const ZOOMS = [3, 4, 5, 6];

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function detectRegion(): TileRegion {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (tz.startsWith("Europe/")) return "europe";
  } catch {
    /* fall through */
  }
  return "us";
}

export function regionLabel(region: TileRegion): string {
  return REGIONS[region].label;
}

function lonToTile(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

function latToTile(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

/** Every tile URL covering the region at the cached zoom levels. */
export function regionTileUrls(region: TileRegion): string[] {
  const r = REGIONS[region];
  const urls: string[] = [];
  for (const z of ZOOMS) {
    const x0 = lonToTile(r.minLon, z);
    const x1 = lonToTile(r.maxLon, z);
    const y0 = latToTile(r.maxLat, z); // north edge = smaller y
    const y1 = latToTile(r.minLat, z);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        urls.push(OSM.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)));
      }
    }
  }
  return urls;
}

export type PrecacheProgress = { done: number; total: number; failed: number };

/**
 * Download the region's tiles into the dedicated cache. Already-cached
 * tiles are skipped, so re-running after a partial run resumes cheaply.
 */
export async function precacheRegion(
  region: TileRegion,
  onProgress?: (p: PrecacheProgress) => void,
): Promise<PrecacheProgress> {
  const urls = regionTileUrls(region);
  const cache = await caches.open(TILE_CACHE);
  let done = 0;
  let failed = 0;
  const total = urls.length;

  // Small batches: polite to the tile server and survivable on a phone.
  const BATCH = 6;
  for (let i = 0; i < urls.length; i += BATCH) {
    await Promise.all(
      urls.slice(i, i + BATCH).map(async (url) => {
        try {
          if (await cache.match(url)) {
            done++;
            return;
          }
          const res = await fetch(url, { mode: "cors" });
          if (res.ok) {
            await cache.put(url, res);
            done++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }),
    );
    onProgress?.({ done, total, failed });
  }
  return { done, total, failed };
}

/** Rough count of cached region tiles, for the UI label. */
export async function cachedTileCount(): Promise<number> {
  try {
    const cache = await caches.open(TILE_CACHE);
    return (await cache.keys()).length;
  } catch {
    return 0;
  }
}

export async function clearRegionCache(): Promise<void> {
  try {
    await caches.delete(TILE_CACHE);
  } catch {
    /* no cache API */
  }
}
