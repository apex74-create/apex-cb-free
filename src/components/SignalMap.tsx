import { useEffect, useMemo, useRef, useState } from "react";
import type { Tool } from "@/lib/tools";
import { useBridgeState } from "@/lib/bridge-hooks";
import { parseScanResults, useLiveCommand, type AccessPoint } from "@/lib/live-data";
import { createGpsFilter, distanceMeters } from "@/lib/gps-filter";
import { reportMap, resetMap } from "@/lib/map-status";
import { meshGrid, spearLegs, stackRings } from "@/lib/map-geometry";
import { useMapPrefs } from "@/lib/map-prefs";
import { detectProfile, makeRedrawGate } from "@/lib/map-throttle";
import { tremorBand, tremorColor, tremorHops, tremorWeight, type TremorHop } from "@/lib/tremor";
import TremorLegend from "@/components/TremorLegend";
import MapFxCanvas, { type FxPoint } from "@/components/MapFxCanvas";
import { getSelfFix, subscribeSelfFix, type SelfFix } from "@/lib/self-locate";
import { acquireSeed, getSeed, subscribeSeed } from "@/lib/geo-seed";

const LAST_FIX_KEY = "apex.map.lastfix";

/** Last confirmed GPS fix, so a cold start opens where you actually are. */
function readLastFix(): { lat: number; lon: number } | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_FIX_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { lat: number; lon: number };
    return Number.isFinite(v?.lat) && Number.isFinite(v?.lon) ? { lat: v.lat, lon: v.lon } : null;
  } catch {
    return null;
  }
}

const TONE_HEX: Record<Tool["tone"], string> = {
  green: "#ff3bd4",
  amber: "#ff9900",
  red: "#ff3366",
  cyan: "#00ccff",
};

type Fix = { lat: number; lon: number; acc: number; at: number };

/** Same basemap set the phone PWA ships, so a map looks identical on either build. */
const BASEMAPS = {
  sat: {
    label: "sat",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  },
  osm: { label: "osm", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png" },
  dark: { label: "dark", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png" },
} as const;
type BasemapKey = keyof typeof BASEMAPS;

/**
 * Real data only:
 *  - position + breadcrumb come from the device GPS (watchPosition)
 *  - emitters come from `adb shell cmd wifi list-scan-results` on the phone
 *  - tremor intensity is derived from those fixes (see src/lib/tremor.ts)
 *
 * A scan result carries RSSI but no bearing, so an access point is drawn as a
 * distance ring around the fix (log-distance path loss), never as a fake point.
 */
export type MapReading = {
  id: number | string;
  source: "pcap" | "cyd";
  ssid: string | null;
  bssid: string | null;
  rssi: number | null;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  observed_at: string;
};

const READING_COLOR: Record<MapReading["source"], string> = { pcap: "#ffaa00", cyd: "#00ccff" };
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export default function SignalMap({ tool, basic = false, readings }: { tool: Tool; basic?: boolean; readings?: MapReading[] | undefined }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [trail, setTrail] = useState<Fix[]>([]);
  const [gpsError, setGpsError] = useState<string | null>(null);
  /** Super Bumbershoot self-location — used whenever the GPS has nothing. */
  const [selfFix, setSelfFix] = useState<SelfFix | null>(null);
  /** Bumbershoot estimate breadcrumb — the solver's own trail, kept separate
   * from the GPS trail so measured and estimated never blend on screen. */
  const [selfTrail, setSelfTrail] = useState<SelfFix[]>([]);
  /** Coarse seed position — guarantees the map lands somewhere real from main. */
  const [seedPos, setSeedPos] = useState<{ lat: number; lon: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const tileRef = useRef<import("leaflet").TileLayer | null>(null);
  const [tileUnavailable, setTileUnavailable] = useState(false);
  const [chrome, setChrome] = useState(false);
  const [legend, setLegend] = useState(true);
  const state = useBridgeState();

  /** Layer toggles, opacity and zoom survive a reload. */
  const { prefs, update, hydrated } = useMapPrefs();
  const basemap = prefs.basemap as BasemapKey;
  const basemapRef = useRef<BasemapKey>(basemap);
  basemapRef.current = basemap;
  const [zoomLevel, setZoomLevel] = useState(prefs.zoom);

  /** Frame/redraw budget for this device class (watch, legacy WebView, phone). */
  const profile = useMemo(() => detectProfile(), []);

  const isTrail = tool.overlay === "trail";
  const scan = useLiveCommand<AccessPoint[]>(
    "shell cmd wifi list-scan-results",
    parseScanResults,
    isTrail ? 0 : 8000,
    !basic,
  );

  /**
   * A poll that errors or briefly returns nothing must not erase what we
   * already plotted — hold the last good scan until a newer one replaces it.
   */
  const lastGoodRef = useRef<AccessPoint[]>([]);
  const aps = useMemo(() => {
    const fresh = scan.data ?? [];
    if (fresh.length) lastGoodRef.current = fresh;
    const list = fresh.length ? fresh : lastGoodRef.current;
    if (tool.overlay === "rf" || tool.overlay === "stack") return list;
    if (tool.overlay === "tetra") return list.slice(0, 3);
    return list.slice(0, 12);
  }, [scan.data, tool.overlay]);

  /** Tremor grading of the breadcrumb trail — the overlay and legend both read this. */
  const hops: TremorHop[] = useMemo(() => tremorHops(trail), [trail]);

  /** Explode-seek contacts: the hottest breadcrumbs the wavefront can catch. */
  const fxPoints: FxPoint[] = useMemo(
    () =>
      hops
        .filter((h) => h.ti >= 0.4)
        .slice(-24)
        .map((h) => ({
          lat: h.to.lat,
          lon: h.to.lon,
          type: h.ti >= 0.8 ? ("unknown" as const) : ("gateway" as const),
          label: `TI ${h.ti.toFixed(2)}`,
        })),
    [hops],
  );

  /* Map bootstrap */
  useEffect(() => {
    if (!hydrated) return; // wait for stored zoom/basemap so we boot once, correctly
    let cancelled = false;
    let resizeTimer = 0;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !ref.current) return;
      leafletRef.current = L;
      const seed = readLastFix();
      const startZoom = seed ? prefs.zoom : 2;
      const map = L.map(ref.current, {
        center: seed ? [seed.lat, seed.lon] : [0, 0],
        zoom: startZoom,
        zoomControl: false,
        attributionControl: false,
        // Watch builds keep the cheaper, non-animated pan/zoom path.
        zoomAnimation: !profile.vectorOnly,
        fadeAnimation: !profile.vectorOnly,
        markerZoomAnimation: !profile.vectorOnly,
        preferCanvas: false,
      });
      // Never zoom out past world coverage: a tall container at zoom 2 shows
      // empty grey bands above and below the map. Floor the zoom at whatever
      // fits the world in this container.
      const worldZoom = map.getBoundsZoom([[-85, -180], [85, 180]]);
      map.setMinZoom(worldZoom);
      if (map.getZoom() < worldZoom) map.setZoom(worldZoom);
      setZoomLevel(map.getZoom());
      const tiles = L.tileLayer(BASEMAPS[basemapRef.current].url, { maxZoom: 19 }).addTo(map);
      tileRef.current = tiles;
      let loaded = 0;
      let errored = 0;
      tiles.on("tileload", () => {
        setTileUnavailable(false);
        reportMap({ tilesLoaded: ++loaded });
      });
      tiles.on("tileerror", () => {
        errored += 1;
        if (errored >= 3 && loaded === 0) setTileUnavailable(true);
        reportMap({ tileErrors: errored });
      });
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      // Phone-build gestures: dragging the map breaks follow-lock until re-armed.
      map.on("dragstart", () => update("follow", false));
      map.on("zoomend", () => {
        const z = map.getZoom();
        setZoomLevel(z);
        update("zoom", z);
      });
      resizeTimer = window.setTimeout(() => {
        if (!cancelled && mapRef.current === map) map.invalidateSize();
      }, 60);
      // Keep the resize tied to the live map: rapidly switching shield views
      // must not ask Leaflet to animate an already removed container.
      if (!cancelled) setMapReady(true);
      reportMap({ tool: tool.key, ready: true, tilesLoaded: 0, tileErrors: 0 });
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(resizeTimer);
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
      readingsLayerRef.current = null;
      layerRef.current = null;
      resetMap();
    };
    // prefs.zoom is only a seed value; re-reading it must not rebuild the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool.key, hydrated]);

  /**
   * Full-bleed sizing: the map fills whatever viewport it lands in (watch face
   * or full phone PWA window), so any container/orientation change must be
   * pushed into Leaflet or tiles render at the old size.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const sync = () => {
      mapRef.current?.invalidateSize();
      const r = el.getBoundingClientRect();
      reportMap({ width: Math.round(r.width), height: Math.round(r.height) });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("orientationchange", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", sync);
    };
  }, [mapReady]);

  /* Real GPS — Kalman-smoothed so the marker doesn't jitter while moving */
  const filterRef = useRef(createGpsFilter());
  const [noise, setNoise] = useState(0);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsError("no geolocation");
      return;
    }
    const filter = filterRef.current;
    filter.reset();
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const smooth = filter.push({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          acc: pos.coords.accuracy,
          at: pos.timestamp,
        });
        setNoise(filter.rejected());
        if (!smooth) return; // rejected outlier: keep the marker where it is
        setGpsError(null);
        const next: Fix = { lat: smooth.lat, lon: smooth.lon, acc: smooth.acc, at: smooth.at };
        setFix((prev) =>
          prev && !smooth.moving && Math.abs(prev.acc - next.acc) < 1 ? prev : next,
        );
        try {
          localStorage.setItem(LAST_FIX_KEY, JSON.stringify({ lat: next.lat, lon: next.lon }));
        } catch {
          /* private mode: a cold start just opens at world view */
        }
        if (!smooth.moving) return; // stationary: no new breadcrumb
        setTrail((prev) => {
          const last = prev[prev.length - 1];
          if (last && distanceMeters(last, next) < 3) return prev;
          return [...prev, next].slice(-200);
        });
      },
      (err) => setGpsError(err.message.toLowerCase()),
      // maximumAge 0 pins the GNSS chip on continuously — on a watch battery
      // that means thermal throttle and shutdown. A 1s cache is still live
      // tracking, and the Kalman filter already absorbs the extra latency.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  /**
   * Coming in cold from the landing page there is no GPS lock yet, so the map
   * would sit on the world view with no ping at all. Read the shared coarse
   * seed (and ask for a one-shot fix if there is none) so a ping always lands.
   */
  useEffect(() => {
    const read = () => {
      const s = getSeed();
      setSeedPos(s ? { lat: s.lat, lon: s.lon } : readLastFix());
    };
    read();
    const stop = subscribeSeed(read);
    if (!getSeed() && !readLastFix()) void acquireSeed().then(read);
    return stop;
  }, []);

  /**
   * Denied-mode self-location. Once the bumbershoot canopy closes, the radar
   * publishes a projected fix; with no satellite fix the map homes on it
   * instead of hanging on the world view.
   */
  useEffect(() => {
    const read = () => {
      const sf = getSelfFix();
      setSelfFix(sf);
      // Lay a bumbershoot crumb when the estimate moves — capped, and only
      // when it actually shifted, so a parked device doesn't stack duplicates.
      if (sf) {
        setSelfTrail((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.ts === sf.ts) return prev;
          if (last && distanceMeters(last, sf) < 3) return prev;
          return [...prev.slice(-199), sf];
        });
      }
    };
    read();
    const stop = subscribeSelfFix(read);
    const t = window.setInterval(read, 5000);
    return () => {
      stop();
      window.clearInterval(t);
    };
  }, []);

  /* Basemap swap — same layer set as the phone PWA */
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;
    tileRef.current?.remove();
    setTileUnavailable(false);
    const tiles = L.tileLayer(BASEMAPS[basemap].url, { maxZoom: 19 }).addTo(map);
    let loaded = 0;
    let errored = 0;
    tiles.on("tileload", () => {
      loaded += 1;
      setTileUnavailable(false);
    });
    tiles.on("tileerror", () => {
      errored += 1;
      if (errored >= 3 && loaded === 0) setTileUnavailable(true);
    });
    tiles.bringToBack();
    tileRef.current = tiles;
  }, [basemap, mapReady]);

  /** Source-labeled readings layer: only rows that carry a reported position are drawn. */
  const readingsLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map || !readings) return;
    if (!readingsLayerRef.current) readingsLayerRef.current = L.layerGroup().addTo(map);
    const layer = readingsLayerRef.current;
    layer.clearLayers();
    const pts = readings.filter((r) => r.lat !== null && r.lng !== null);
    pts.forEach((r) => {
      const c = READING_COLOR[r.source];
      const at: [number, number] = [r.lat!, r.lng!];
      if (r.accuracy_m && r.accuracy_m > 0) {
        L.circle(at, { radius: r.accuracy_m, color: c, weight: 0.8, opacity: 0.5, fillOpacity: 0.06, interactive: false }).addTo(layer);
      }
      if (fix) L.polyline([[fix.lat, fix.lon], at], { color: c, weight: 0.7, opacity: 0.35, dashArray: "3 5", interactive: false }).addTo(layer);
      L.circleMarker(at, { radius: 5, color: c, weight: 1.5, fillColor: c, fillOpacity: 0.7 })
        .bindPopup(
          `<div style="font-family:monospace;font-size:11px;line-height:1.4">` +
            `<b>${esc(r.ssid ?? "<hidden>")}</b><br/>` +
            `source: ${r.source.toUpperCase()}<br/>` +
            (r.bssid ? `bssid: ${esc(r.bssid)}<br/>` : "") +
            (r.rssi !== null ? `rssi: ${r.rssi} dBm<br/>` : "") +
            `accuracy: ${r.accuracy_m ? `±${Math.round(r.accuracy_m)} m` : "not reported"}<br/>` +
            `last seen: ${esc(new Date(r.observed_at).toLocaleString())}</div>`,
        )
        .addTo(layer);
    });
  }, [readings, mapReady, fix]);

  /**
   * Draw pass. The overlay geometry (mesh graticule, spear bearings, stack
   * rings) is projected from the fix itself, so the screen is never blank just
   * because the bridge has no scan results yet.
   *
   * The whole pass runs behind a redraw gate: on the watch a GPS burst can fire
   * several fixes a second, and rebuilding every vector each time is what makes
   * the face stall out mid-redraw.
   */
  const gateRef = useRef(makeRedrawGate(profile.redrawMs));
  /** True once the first fix has homed the view; stops later fixes re-snapping zoom. */
  const homedRef = useRef(false);
  const lastPanRef = useRef(0);
  useEffect(() => () => gateRef.current.cancel(), []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!mapReady || !L || !map || !layer) return;

    gateRef.current.run(() => {
      if (!mapRef.current || !layerRef.current) return;
      // GPS first, then the bumbershoot self-location, then the last known fix.
      const selfAnchor: Fix | null = selfFix
        ? { lat: selfFix.lat, lon: selfFix.lon, acc: selfFix.sigma, at: selfFix.ts }
        : null;
      const coarse = readLastFix() ?? seedPos;
      const anchor = fix ?? selfAnchor ?? (coarse ? { ...coarse, acc: 0, at: 0 } : null);
      const selfLocated = !fix && !!selfAnchor;
      if (!anchor) return; // no position at all yet — leave the world view up
      layer.clearLayers();
      reportMap({ fix: !!fix, markers: isTrail ? trail.length : aps.length });

      const hex = TONE_HEX[tool.tone];
      const op = prefs.opacity;
      const center: [number, number] = [anchor.lat, anchor.lon];
      // Snap to the fix only on the first one. Doing it on every update means a
      // deliberate zoom-out to world view is yanked back to street level by the
      // next GPS tick, which makes the map impossible to navigate while tracking.
      if (!homedRef.current && map.getZoom() < 5) {
        homedRef.current = true;
        map.setView(center, prefs.zoom);
      } else if (
        prefs.follow &&
        distanceMeters({ lat: map.getCenter().lat, lon: map.getCenter().lng }, anchor) > 1.5
      ) {
        // Glide instead of snapping — but if fixes arrive faster than the glide
        // lasts, the animations queue up and the marker rubber-bands behind the
        // real position, so a rapid burst gets an instant pan instead.
        const now = Date.now();
        const rapid = now - lastPanRef.current < 700;
        lastPanRef.current = now;
        map.panTo(center, {
          animate: !profile.vectorOnly && !rapid,
          duration: 0.6,
          easeLinearity: 0.4,
        });
      }

      /* ---- overlay scaffold: always visible, derived from the fix ---- */
      const overlay = tool.overlay;
       if (overlay === "mesh" && !basic && aps.length > 0) {
        meshGrid(anchor, 400, 8).forEach((line) =>
          L.polyline(line, {
            color: hex,
            weight: 0.6,
            opacity: 0.45 * op,
            interactive: false,
          }).addTo(layer),
        );
      }
       if (overlay === "tetra" && !basic && aps.length > 0) {
        spearLegs(anchor, 260).forEach(({ line, bearing }) =>
          L.polyline(line, { color: hex, weight: 1.4, opacity: 0.8 * op, interactive: false })
            .addTo(layer)
            .bindTooltip(`spear ${bearing.toFixed(0)}°`),
        );
      }
       if (!basic && aps.length > 0 && (overlay === "stack" || overlay === "rf")) {
        stackRings(50, 5).forEach((r) =>
          L.circle(center, {
            radius: r,
            color: hex,
            weight: 0.6,
            opacity: 0.4 * op,
            fill: false,
            interactive: false,
          }).addTo(layer),
        );
      }

      /**
       * Watch/legacy builds get no effects canvas, so the explode-seek pulse is
       * approximated with three CSS-animated vector rings — cheap enough for
       * the AOSP compositor, still shows the sweep.
       */
       if (!basic && prefs.explode && profile.vectorOnly && hops.length > 0) {
        [40, 90, 150].forEach((r, i) =>
          L.circle(center, {
            radius: r,
            color: hex,
            weight: 1,
            opacity: (0.5 - i * 0.12) * op,
            fill: false,
            interactive: false,
            className: `apex-pulse-ring apex-pulse-${i}`,
          }).addTo(layer),
        );
      }

      // Position ping: always present so arriving from main shows a live
      // marker even before the first GPS lock settles.
      [16, 34].forEach((r, i) =>
        L.circle(center, {
          radius: r,
          color: hex,
          weight: 1,
          opacity: (0.55 - i * 0.2) * op,
          fill: false,
          interactive: false,
          className: `apex-pulse-ring apex-pulse-${i}`,
        }).addTo(layer),
      );

      L.circleMarker(center, {
        radius: 5,
        color: hex,
        weight: 2,
        fillColor: hex,
        fillOpacity: fix || selfLocated ? 0.9 : 0.35,
        dashArray: selfLocated ? "3 3" : undefined,
      })
        .addTo(layer)
        .bindTooltip(
          fix
            ? `THIS DEVICE · ±${Math.round(anchor.acc)}m`
            : selfLocated
              ? `BUMBERSHOOT · ${selfFix!.source} · ±${Math.round(selfFix!.sigma)}m`
              : "LAST KNOWN FIX",
        );
      if (selfLocated) {
        // the solver's own 1-sigma, drawn honestly — no GPS accuracy implied
        L.circle(center, {
          radius: selfFix!.sigma,
          color: hex,
          weight: 1,
          opacity: 0.35,
          dashArray: "4 4",
          fill: false,
          interactive: false,
        }).addTo(layer);
      }
      if (fix) {
        L.circle(center, {
          radius: anchor.acc,
          color: hex,
          weight: 1,
          opacity: 0.25,
          fill: false,
        }).addTo(layer);
      }

      /* Bumbershoot trail — the solver's estimated breadcrumb, drawn dashed
       * in amber so it can never be mistaken for the measured GPS trail.
       * Lets you walk in satellite mode and watch the estimate resolve
       * against where the satellites say you actually went. */
      if (selfTrail.length > 1) {
        L.polyline(
          selfTrail.map((p) => [p.lat, p.lon] as [number, number]),
          {
            color: "#ffb020",
            weight: 1.5,
            opacity: 0.55 * op,
            dashArray: "5 6",
            interactive: false,
          },
        ).addTo(layer);
        selfTrail.forEach((p) => {
          L.circleMarker([p.lat, p.lon], {
            radius: 3,
            color: "#ffb020",
            weight: 1,
            dashArray: "2 3",
            fill: false,
            opacity: 0.7 * op,
          })
            .addTo(layer)
            .bindTooltip(
              `BUMBERSHOOT EST · ±${Math.round(p.sigma)}m · ${p.anchors} anchors · ${new Date(p.ts).toLocaleTimeString()}`,
            );
        });
      }

      /* ---- Tremor intensity field -------------------------------------
       * Renders on every overlay mode, not just the breadcrumb tool: a
       * graded segment per hop plus a soft intensity blob at each sample so
       * hot ground reads at a glance on a 400px face. */
      if (prefs.tremor && hops.length) {
        // Original breadcrumb behaviour: one graded dot per sample plus the
        // graded hop line. No dark casing — the basemap is dark enough now,
        // and dropping the second polyline halves the drawing work per frame.
        hops.forEach((h) => {
          L.circleMarker([h.to.lat, h.to.lon], {
            radius: 2.5 + h.ti * 4,
            stroke: false,
            fillColor: tremorColor(h.ti),
            fillOpacity: Math.min(0.9, (0.5 + h.ti * 0.4) * op),
            interactive: false,
          }).addTo(layer);
          L.polyline(
            [
              [h.from.lat, h.from.lon],
              [h.to.lat, h.to.lon],
            ],
            {
              color: tremorColor(h.ti),
              weight: tremorWeight(h.ti),
              opacity: Math.min(1, (0.5 + h.ti * 0.5) * op),
              lineCap: "round",
            },
          )
            .addTo(layer)
            .bindTooltip(
              `TI ${h.ti.toFixed(2)} · ${tremorBand(h.ti).label} · ${h.accel.toFixed(2)} m/s² · ${h.speed.toFixed(1)} m/s`,
            );
        });
      }

      if (isTrail) {
        if (!prefs.tremor && trail.length > 1) {
          L.polyline(
            trail.map((p) => [p.lat, p.lon] as [number, number]),
            { color: hex, weight: 2, opacity: 0.7 * op },
          ).addTo(layer);
        }
        return;
      }

      aps.forEach((ap) => {
        L.circle(center, {
          radius: ap.distance,
          color: hex,
          weight: 1,
          opacity: Math.min(0.75, Math.max(0.15, (ap.rssi + 100) / 70)) * op,
          fill: false,
        })
          .addTo(layer)
          .bindTooltip(`${ap.ssid} · ${ap.rssi} dBm · ~${ap.distance.toFixed(0)}m · ${ap.freq}MHz`);
      });
    });
  }, [
    aps,
    basic,
    fix,
    hops,
    isTrail,
    mapReady,
    prefs.explode,
    prefs.follow,
    prefs.opacity,
    prefs.tremor,
    prefs.zoom,
    profile.vectorOnly,
    selfFix,
    selfTrail,
    seedPos,
    trail,
    tool.tone,
    tool.overlay,
  ]);

  const recenter = () => {
    update("follow", true);
    const map = mapRef.current;
    const home = fix ?? selfFix;
    if (map && home)
      map.setView([home.lat, home.lon], Math.max(map.getZoom(), 17), { animate: true });
  };
  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    const z = map.getZoom() + delta;
    map.setZoom(z);
    setZoomLevel(z);
    update("zoom", z);
  };

  const sourceLabel = isTrail
    ? `${trail.length} fixes`
    : scan.error
      ? "no scan"
      : `${aps.length} ap`;
  const statusLabel = fix
    ? `gps ±${Math.round(fix.acc)}m${noise ? ` · ${noise} drop` : ""}`
    : selfFix
      ? `bumbershoot ±${Math.round(selfFix.sigma)}m · ${selfFix.anchors} anchors`
      : gpsError
        ? `gps: ${gpsError}`
        : "waiting for gps";

   const blocked = !basic && !isTrail && !!scan.error;
  const showLegend = prefs.tremor && legend && hops.length > 0;
  const placed = (readings ?? []).filter((r) => r.lat !== null && r.lng !== null);

  return (
    <div className={`absolute inset-0 ${basemap === "sat" ? "apex-map-sat" : basemap === "osm" ? "apex-map-osm" : "apex-map-dark"}`}>
      <div ref={ref} className="absolute inset-0" />

       {!basic && <MapFxCanvas
        map={mapReady ? mapRef.current : null}
        origin={fix}
        points={fxPoints}
        explode={prefs.explode}
        ir={prefs.ir}
        opacity={prefs.opacity}
       />}

      {blocked ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-background/85 p-2 text-center">
          <p className="text-[9px] uppercase tracking-widest text-alert">
            no source · {scan.error}
          </p>
          <p className="mt-0.5 text-[8px] uppercase tracking-wider text-muted-foreground">
            bridge {state} — scan results come from the phone
          </p>
        </div>
      ) : null}
      {tileUnavailable ? (
        <div className="pointer-events-none absolute inset-x-12 top-10 z-[499] bg-background/90 px-2 py-1 text-center text-[9px] uppercase text-warn">
          map layer unavailable · dark surface active
        </div>
      ) : null}

      {/* Chrome collapses so the controls never sit on top of the plot.
          Sits below the page header so the two never overlap. */}
      <button
        type="button"
        onClick={() => setChrome((v) => !v)}
        aria-pressed={chrome}
        aria-label={chrome ? "Hide map controls" : "Show map controls"}
        className="apex-map-control absolute right-2 top-10 z-[501] rounded-md border border-signal bg-background/95 text-[20px] leading-none text-signal"
      >
        {chrome ? "×" : "≡"}
      </button>

      {readings ? (
        <div className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded-sm border border-border bg-background/90 px-2 py-1 font-mono text-[10px] text-muted-foreground">
          <div><span style={{ color: READING_COLOR.cyd }}>●</span> CYD reading · <span style={{ color: READING_COLOR.pcap }}>●</span> PCAP relay</div>
          <div>{placed.length} placed · {readings.length - placed.length} without position (not drawn)</div>
        </div>
      ) : null}

      {showLegend ? (
        <div className="absolute left-1.5 top-9 z-[500] max-w-[58%]">
          <TremorLegend hops={hops} compact={profile.vectorOnly} onClose={() => setLegend(false)} />
        </div>
      ) : null}

      {/* Phone-build map chrome: layer switch, overlays, opacity, zoom, follow-lock */}
      <div
        hidden={!chrome}
        className="pointer-events-auto absolute inset-x-2 bottom-10 z-[500] grid grid-cols-4 gap-1 rounded-md border border-border bg-background/95 p-2 shadow-lg"
      >
        <div className="col-span-2 grid grid-cols-3 overflow-hidden rounded-md border border-border bg-background">
          {(Object.keys(BASEMAPS) as BasemapKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => update("basemap", k)}
              aria-pressed={basemap === k}
              className={`apex-map-control px-2 text-[10px] uppercase ${
                basemap === k ? "bg-signal/20 text-signal" : "text-muted-foreground"
              }`}
            >
              {BASEMAPS[k].label}
            </button>
          ))}
        </div>

        {/* Overlay toggles — persisted, so the map comes back the way you left it */}
        <div className="col-span-2 grid grid-cols-3 overflow-hidden rounded-md border border-border bg-background">
          {(
            [
              ["tremor", "trem"],
              ["explode", "expl"],
              ["ir", "ir"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => update(key, !prefs[key])}
              aria-pressed={prefs[key]}
              aria-label={`Toggle ${key} overlay`}
              className={`apex-map-control px-1 text-[9px] uppercase ${
                prefs[key] ? "bg-signal/20 text-signal" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="col-span-2 grid grid-cols-2 overflow-hidden rounded-md border border-border bg-background">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomBy(1)}
            className="apex-map-control text-[20px] leading-none text-signal"
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomBy(-1)}
            className="apex-map-control border-l border-border text-[20px] leading-none text-signal"
          >
            −
          </button>
        </div>
        <button
          type="button"
          aria-label={prefs.follow ? "Following device" : "Recenter on device"}
          onClick={recenter}
          className={`apex-map-control col-span-2 rounded-md border border-border bg-background px-2 text-[10px] uppercase ${
            prefs.follow ? "text-signal" : "text-muted-foreground"
          }`}
        >
          {prefs.follow ? "lock" : "free"}
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-x-2 bg-gradient-to-t from-background to-transparent p-2 text-[9px] uppercase tracking-widest">
        <span className="min-w-0 truncate text-muted-foreground">
          {fix
            ? `${fix.lat.toFixed(4)} / ${fix.lon.toFixed(4)}`
            : basemap === "dark"
              ? "© OpenStreetMap"
              : "—"}
        </span>
        <span className="min-w-0 truncate text-signal">
          z{zoomLevel} · {sourceLabel} · {statusLabel}
        </span>
      </div>
    </div>
  );
}
