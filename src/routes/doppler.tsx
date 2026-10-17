import { createFileRoute, Link } from "@tanstack/react-router";
import AppTopBar from "@/components/AppTopBar";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type DopplerSearch = { lat?: number | undefined; lon?: number | undefined };

const TITLE = "Doppler Radar — Enphase Operator";
const DESCRIPTION =
  "Animated precipitation radar with two hours of past frames and a forward nowcast, drawn over your forecast location.";

function parseCoord(value: unknown, max: number): number | undefined {
  const parsed = Number(typeof value === "string" || typeof value === "number" ? value : NaN);
  return Number.isFinite(parsed) && Math.abs(parsed) <= max ? parsed : undefined;
}

export const Route = createFileRoute("/doppler")({
  validateSearch: (s: Record<string, unknown>): DopplerSearch => ({
    lat: parseCoord(s["lat"], 90),
    lon: parseCoord(s["lon"], 180),
  }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DopplerRoute,
});

type Frame = { time: number; path: string; nowcast: boolean };

/**
 * Doppler layer. Radar frames come from the public RainViewer tile service —
 * no API key, no account. Frames are pre-loaded and swapped so the loop runs
 * smoothly instead of flickering while tiles fetch.
 */
function DopplerRoute() {
  const search = Route.useSearch();
  const lat = search.lat ?? 44.98;
  const lon = search.lon ?? -84.6;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layersRef = useRef<Map<string, import("leaflet").TileLayer>>(new Map());
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const [frames, setFrames] = useState<Frame[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.7);

  // Map bootstrap
  useEffect(() => {
    if (!hostRef.current || typeof window === "undefined") return;
    let alive = true;
    let dispose: (() => void) | null = null;

    void import("leaflet").then((L) => {
      if (!alive || !hostRef.current) return;
      leafletRef.current = L;
      const map = L.map(hostRef.current, { zoomControl: true, attributionControl: false }).setView(
        [lat, lon],
        7,
      );
      mapRef.current = map;
      // Leaflet caches its first viewport. The drawer iframe and fullscreen
      // mode both resize after the map mounts, so refresh tile bounds then.
      const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      observer.observe(hostRef.current);
      const onFullscreen = () => window.setTimeout(() => map.invalidateSize({ pan: false }), 100);
      document.addEventListener("fullscreenchange", onFullscreen);
      // Keyless base map. The Carto dark tiles now watermark "API key required",
      // so the standard OSM tiles are used and darkened in CSS instead — no
      // account, no key, nothing to expire.
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 14,
        className: "doppler-basemap",
        attribution: "© OpenStreetMap",
      }).addTo(map);
      L.circleMarker([lat, lon], {
        radius: 5,
        color: "#22d3ee",
        fillColor: "#22d3ee",
        fillOpacity: 0.8,
      }).addTo(map);

      dispose = () => {
        observer.disconnect();
        document.removeEventListener("fullscreenchange", onFullscreen);
        layersRef.current.clear();
        mapRef.current = null;
        map.remove();
      };
    });

    return () => {
      alive = false;
      dispose?.();
    };
  }, [lat, lon]);

  // Frame index — refreshed every five minutes so the loop stays current.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        if (!res.ok) throw new Error(`radar index ${res.status}`);
        const json = (await res.json()) as {
          radar?: { past?: Array<{ time: number; path: string }>; nowcast?: Array<{ time: number; path: string }> };
        };
        if (!alive) return;
        const past = (json.radar?.past ?? []).map((f) => ({ ...f, nowcast: false }));
        const next = (json.radar?.nowcast ?? []).map((f) => ({ ...f, nowcast: true }));
        const all = [...past, ...next];
        if (all.length === 0) throw new Error("no radar frames published");
        setFrames(all);
        setIndex(Math.max(0, past.length - 1));
        setError(null);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "radar unavailable");
      }
    };
    void load();
    const id = setInterval(() => void load(), 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Paint the active frame, pre-loading neighbours so playback does not flicker.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const frame = frames[index];
    if (!L || !map || !frame) return;

    const ensure = (f: Frame, visible: boolean) => {
      let layer = layersRef.current.get(f.path);
      if (!layer) {
        layer = L.tileLayer(`https://tilecache.rainviewer.com${f.path}/256/{z}/{x}/{y}/4/1_1.png`, {
          opacity: 0,
          zIndex: f.nowcast ? 420 : 410,
          maxZoom: 14,
          // The free radar cache only renders up to zoom 7; deeper zooms upscale those tiles instead of leaving blank blocks.
          maxNativeZoom: 7,
        });
        layer.addTo(map);
        layersRef.current.set(f.path, layer);
      }
      layer.setOpacity(visible ? opacity : 0);
    };

    for (const [path, layer] of layersRef.current) {
      if (path !== frame.path) layer.setOpacity(0);
    }
    ensure(frame, true);
    const ahead = frames[index + 1];
    if (ahead) ensure(ahead, false);
  }, [frames, index, opacity]);

  // Playback
  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % frames.length), 550);
    return () => clearInterval(id);
  }, [playing, frames.length]);

  const frame = frames[index];
  const stamp = frame
    ? new Date(frame.time * 1000).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";

  return (
    <main className="flex h-app flex-col overflow-hidden scan-grid face-pad pb-3 pt-2">
      <AppTopBar title="Doppler Radar" backTo="/forecast" storageKey="doppler">
        <span
          className={`px-1 text-[8px] uppercase tracking-widest ${
            frame?.nowcast ? "text-warn" : "text-scan"
          }`}
        >
          {frame?.nowcast ? "nowcast" : "observed"}
        </span>
      </AppTopBar>

      <div className="mt-2 rounded-sm border border-border bg-card/60 px-2 py-1 text-[8px] uppercase tracking-widest text-muted-foreground">
        {error ? `radar offline · ${error}` : `frame ${index + 1}/${frames.length || 1} · ${stamp}`}
      </div>

      <div className="mt-2 min-h-0 flex-1">
        <div ref={hostRef} className="h-full w-full rounded-sm border border-scan/50" />
      </div>

      <div className="mt-2 grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="rounded-sm border border-signal/60 px-3 py-1.5 text-[8px] uppercase tracking-widest text-signal"
        >
          {playing ? "pause" : "play"}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            setIndex(Number(e.target.value));
          }}
          className="w-full accent-[color:var(--signal)]"
          aria-label="radar frame"
        />
        <button
          type="button"
          onClick={() => setOpacity((o) => (o >= 0.9 ? 0.4 : o + 0.15))}
          className="rounded-sm border border-border px-2 py-1.5 text-[8px] uppercase tracking-widest text-muted-foreground"
        >
          {Math.round(opacity * 100)}%
        </button>
      </div>

      <p className="mt-1 shrink-0 text-[7px] uppercase tracking-widest text-muted-foreground">
        precipitation radar mosaic · two hours past plus forward nowcast
      </p>
    </main>
  );
}
