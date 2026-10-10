/**
 * Map sandbox on the bottom of the CB deck.
 *
 * One map, every layer as a toggle: street / topo / satellite base, live
 * Doppler (RainViewer), and the Apex signal layer (this handset, its field
 * bubble and its Tri-Star header). A small current-conditions window rides
 * in the corner, and severe NWS alerts appear only while the handset is on
 * the net. Leaflet is imported after mount so nothing browser-only runs on
 * the server.
 */
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { spatialHeaderHex } from "@/lib/rooms";
import { fck, fckShort } from "@/lib/temp";
import {
  joinSquad,
  distanceM,
  WIFI_REACH_M,
  PEER_STALE_MS,
  type SquadPeer,
} from "@/lib/squad-positions";
import { loadNwsStations, stations, onStations, listenMeshWx, milesBetween, blendStations, calculateAdvectionArrival, type StationObs } from "@/lib/wx-stations";
import { radioAlerts, onRadioAlerts, type RadioAlert } from "@/lib/radio-alerts";
import { useDeadReckon } from "@/lib/use-dead-reckon";
import { Button } from "@/components/ui/button";

type Base = "street" | "topo" | "sat";
type MapScope = "area" | "town" | "state" | "world";
const MAP_SCOPE: Record<MapScope, { radius: number; zoom: number; label: string }> = {
  area: { radius: 2000, zoom: 14, label: "Area · 2 km" },
  town: { radius: 20000, zoom: 11, label: "Town · 20 km" },
  state: { radius: 250000, zoom: 7, label: "State · 250 km" },
  world: { radius: Infinity, zoom: 2, label: "Worldwide · this room" },
};
type Wx = { t: number; rh: number; dew: number; wind: number; vpd: number };
type Alert = { id: string; event: string; severity: string; headline: string };

const BASES: Record<Base, { url: string; max: number }> = {
  street: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", max: 19 },
  topo: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", max: 17 },
  sat: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    max: 19,
  },
};

const HOME: [number, number] = [45.0, -84.66];
/** pointman spacing — the field bubble drawn around this handset, metres */
const BUBBLE_M = 55;

function vpdKpa(tF: number, rh: number) {
  const c = ((tF - 32) * 5) / 9;
  const es = 0.6108 * Math.exp((17.27 * c) / (c + 237.3));
  return Math.max(0, es * (1 - rh / 100));
}

export function CbMapDeck({
  room = "19",
  roomKey = null,
  privateRoom = false,
  callsign = "",
  keyed = false,
  fullMap = false,
  docked = false,
  messageOpen = false,
  enableLiveFollow = false,
  onDockMap,
  onFullMapChange,
  txHot = {},
}: {
  room?: string;
  roomKey?: CryptoKey | null;
  privateRoom?: boolean;
  callsign?: string;
  keyed?: boolean;
  fullMap?: boolean;
  docked?: boolean;
  messageOpen?: boolean;
  enableLiveFollow?: boolean;
  onDockMap?: () => void;
  onFullMapChange?: (expanded: boolean) => void;
  /** callsign → last transmission time; lines to a transmitting peer flash red */
  txHot?: Record<string, number>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const baseLayer = useRef<import("leaflet").TileLayer | null>(null);
  const radar = useRef<import("leaflet").TileLayer | null>(null);
  const signal = useRef<import("leaflet").LayerGroup | null>(null);
  const squadLayer = useRef<import("leaflet").LayerGroup | null>(null);

  const [base, setBase] = useState<Base>("topo");
  const [dopp, setDopp] = useState(true);
  const [apex, setApex] = useState(true);
  const [pos, setPos] = useState<[number, number]>(HOME);
  const [acc, setAcc] = useState(50);
  const [fix, setFix] = useState(false);
  const [positionSource, setPositionSource] = useState<"fallback" | "browser" | "manual">("fallback");
  const [locationAge, setLocationAge] = useState(0);
  const [manualMode, setManualMode] = useState(false);
  const [squadStatus, setSquadStatus] = useState("not sharing");
  const [wx, setWx] = useState<Wx | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  /** bumps when a hot transmission fades so red routing lines clear themselves */
  const [hotTick, setHotTick] = useState(0);

  /* A routing line stays red for 4 s after the last transmission from either
   * end; this timer wakes the draw pass when the last hot line should fade. */
  useEffect(() => {
    const now = Date.now();
    const fresh = Object.values(txHot).filter((t) => now - t < 4000);
    if (!fresh.length) return;
    const id = window.setTimeout(() => setHotTick((n) => n + 1), 4100);
    return () => window.clearTimeout(id);
  }, [txHot, hotTick]);
  const [squad, setSquad] = useState(false);
  const [showSt, setShowSt] = useState(true);
  const [stList, setStList] = useState<StationObs[]>([]);
  const [radio, setRadio] = useState<RadioAlert[]>([]);
  const [picked, setPicked] = useState<StationObs | null>(null);
  const [zoom, setZoom] = useState(12);
  const [macroFollow, setMacroFollow] = useState(false);
  const [scope, setScope] = useState<MapScope>("area");
  const [homeAnchor, setHomeAnchor] = useState<[number, number] | null>(null);
  const [showSquadDetails, setShowSquadDetails] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const stLayer = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    listenMeshWx();
    setStList(stations());
    setRadio(radioAlerts());
    const a = onStations(() => setStList(stations()));
    const b = onRadioAlerts(() => setRadio(radioAlerts()));
    return () => {
      a();
      b();
    };
  }, []);
  const [peers, setPeers] = useState<Record<string, SquadPeer>>({});
  const seed = useRef<[number, number]>(pos);

  /* footstep tracking — keeps the pin walking when the satellites drop out */
  const reckon = useDeadReckon(squad, seed.current);
  useEffect(() => {
    if (!reckon || !reckon.lastFixAt || positionSource === "manual") return;
    setPos([reckon.lat, reckon.lon]);
    setAcc(reckon.acc);
    if (reckon.source === "gps") { setFix(true); setPositionSource("browser"); setLocationAge(reckon.lastFixAt); }
  }, [reckon, positionSource]);

  const posRef = useRef({ pos, acc, fix, positionSource });
  posRef.current = { pos, acc, fix, positionSource };

  /* squad sharing — opt in, sealed per room */
  useEffect(() => {
    if (!squad) {
      setPeers({});
      setSquadStatus("not sharing");
      return;
    }
    if (privateRoom && !roomKey) {
      setPeers({});
      setSquadStatus("unlocking private room");
      return;
    }
    const me = callsign || "UNIT";
    const s = joinSquad(room, roomKey, me, (p) => setPeers((m) => ({ ...m, [p.id]: p })), setSquadStatus);
    const beat = () => {
      const c = posRef.current;
      if (c.positionSource === "fallback") return;
      void s.send(c.pos[0], c.pos[1], c.acc, c.positionSource);
    };
    // Position (satellite, Wi-Fi or footsteps) comes from useDeadReckon above.
    const t = window.setInterval(() => {
      beat();
      const now = Date.now();
      setPeers((m) =>
        Object.fromEntries(Object.entries(m).filter(([, p]) => now - p.at < PEER_STALE_MS)),
      );
    }, 15_000);
    const first = window.setTimeout(beat, 1500);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(first);
      s.leave();
    };
  }, [squad, room, roomKey, privateRoom, callsign]);

  useEffect(() => {
    if (!manualMode || !map.current) return;
    const m = map.current;
    const choose = (event: import("leaflet").LeafletMouseEvent) => {
      setPos([event.latlng.lat, event.latlng.lng]);
      setAcc(25);
      setFix(true);
      setPositionSource("manual");
      setLocationAge(Date.now());
      setManualMode(false);
    };
    m.once("click", choose);
    return () => { m.off("click", choose); };
  }, [manualMode, ready]);

  /* refresh radar every five minutes */
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 5 * 60_000);
    return () => window.clearInterval(t);
  }, []);

  /* map boot */
  useEffect(() => {
    let dead = false;
    void import("leaflet").then((mod) => {
      if (dead || !host.current || map.current) return;
      L.current = mod;
      map.current = mod
        .map(host.current, { zoomControl: false, attributionControl: false, maxZoom: 23 })
        .setView(HOME, 12);
      map.current.on("zoomend", () => setZoom(map.current?.getZoom() ?? 12));
      setReady(true);
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const refresh = () => map.current?.invalidateSize();
    const frame = requestAnimationFrame(refresh);
    window.addEventListener("resize", refresh);
    const observer = host.current ? new ResizeObserver(refresh) : null;
    if (host.current && observer) observer.observe(host.current);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", refresh); observer?.disconnect(); };
  }, [ready, fullMap]);

  /* position */
  const locate = () => {
    const apply = (p: GeolocationPosition) => {
      setPos([p.coords.latitude, p.coords.longitude]);
      setAcc(p.coords.accuracy);
      setFix(true);
      setPositionSource("browser");
      setLocationAge(Date.now());
      if (macroFollow) map.current?.setView([p.coords.latitude, p.coords.longitude], Math.max(map.current.getZoom(), 12));
    };
    // Chromebooks have no GPS chip: a quick network fix lands in seconds, then the precise one refines it.
    navigator.geolocation?.getCurrentPosition(apply, () => undefined, { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 });
    navigator.geolocation?.getCurrentPosition(
      apply,
      () => { if (positionSource === "fallback") setFix(false); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 },
    );
  };
  useEffect(() => {
    if (ready) locate();
  }, [ready]);

  useEffect(() => {
    if (!macroFollow || !ready || positionSource === "fallback") return;
    map.current?.panTo(pos, { animate: false });
  }, [macroFollow, ready, pos, positionSource]);

  const scopeCenter = homeAnchor ?? (positionSource === "fallback" ? null : pos);
  const visiblePeers = Object.values(peers)
    .filter((p) => Date.now() - p.at < PEER_STALE_MS)
    .filter((p) => !scopeCenter || distanceM({ lat: scopeCenter[0], lon: scopeCenter[1] }, p) <= MAP_SCOPE[scope].radius)
    .sort((a, b) => b.at - a.at).slice(0, 80);
  const chooseScope = (next: MapScope) => {
    setScope(next);
    const center = homeAnchor ?? (positionSource === "fallback" ? null : pos);
    if (center) map.current?.setView(center, MAP_SCOPE[next].zoom);
    setMacroFollow(false);
  };

  // The pulled-up handset map needs continuous fixes even when Squad sharing is off.
  // This remains local to this viewport and stops when the map is tucked or Follow is off.
  useEffect(() => {
    if (!enableLiveFollow || !macroFollow || !navigator.geolocation) return;
    const watcher = navigator.geolocation.watchPosition(({ coords }) => {
      setPos([coords.latitude, coords.longitude]);
      setAcc(coords.accuracy);
      setFix(true);
      setPositionSource("browser");
      setLocationAge(Date.now());
    }, () => undefined, { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
    return () => navigator.geolocation.clearWatch(watcher);
  }, [enableLiveFollow, macroFollow]);

  /* base layer */
  useEffect(() => {
    if (!ready || !L.current || !map.current) return;
    baseLayer.current?.remove();
    const b = BASES[base];
    baseLayer.current = L.current
      .tileLayer(b.url, { maxNativeZoom: b.max, maxZoom: 23, className: base === "sat" ? "cb-map-satellite" : "cb-map-tiles", errorTileUrl: "" })
      .addTo(map.current);
    baseLayer.current.bringToBack();
  }, [ready, base]);

  useEffect(() => {
    baseLayer.current?.setOpacity(zoom > BASES[base].max ? 0 : 1);
    radar.current?.setOpacity(zoom > 17 ? 0 : 0.35);
  }, [zoom, base, ready, tick, dopp]);

  /* live doppler */
  useEffect(() => {
    if (!ready || !L.current || !map.current) return;
    radar.current?.remove();
    radar.current = null;
    if (!dopp) return;
    let dead = false;
    fetch("https://api.rainviewer.com/public/weather-maps.json")
      .then((r) => r.json())
      .then((j: { host: string; radar: { past: { path: string }[] } }) => {
        const last = j.radar.past.at(-1);
        if (dead || !last || !L.current || !map.current) return;
        radar.current = L.current
          .tileLayer(`${j.host}${last.path}/256/{z}/{x}/{y}/4/1_1.png`, { opacity: map.current.getZoom() > 17 ? 0 : 0.35, maxNativeZoom: 7, maxZoom: 23 })
          .addTo(map.current);
      })
      .catch(() => undefined);
    return () => {
      dead = true;
    };
  }, [ready, dopp, tick]);

  /* apex signal layer */
  useEffect(() => {
    if (!ready || !L.current || !map.current) return;
    signal.current?.remove();
    signal.current = null;
    if (!apex || positionSource === "fallback") return;
    const g = L.current.layerGroup();
    const sig = host.current ? getComputedStyle(host.current).getPropertyValue("--signal").trim() : "";
    const color = sig || "currentColor";
    L.current.circle(pos, { radius: BUBBLE_M, color, weight: 1, fillOpacity: 0.08 }).addTo(g);
    L.current.circle(pos, { radius: BUBBLE_M * 3, color, weight: 1, dashArray: "4 6", fill: false }).addTo(g);
    L.current
      .circleMarker(pos, { radius: 6, color, weight: 2, fillOpacity: 0.9 })
      .bindTooltip(`this handset · tri ${spatialHeaderHex()}`)
      .addTo(g);
    g.addTo(map.current);
    signal.current = g;
  }, [ready, apex, pos, positionSource]);

  /* squad overlay — estimated spots, reach rings, link lines */
  useEffect(() => {
    if (!ready || !L.current || !map.current) return;
    squadLayer.current?.remove();
    squadLayer.current = null;
    if (!squad) return;
    const Lf = L.current;
    const g = Lf.layerGroup();
    const cs = host.current ? getComputedStyle(host.current) : null;
    const sig = cs?.getPropertyValue("--signal").trim() || "currentColor";
    const warn = cs?.getPropertyValue("--warn").trim() || "currentColor";
    const hot = cs?.getPropertyValue("--alert").trim() || "currentColor";
    const now = Date.now();
    const isHot = (from: string) => {
      const t = txHot[from];
      return !!t && now - t < 4000;
    };
    const nodes = [
      ...(positionSource === "fallback" ? [] : [{ from: callsign || "YOU", lat: pos[0], lon: pos[1], acc, me: true, source: positionSource }]),
      ...visiblePeers.map((p) => ({ ...p, me: false })),
    ];
    // Screen-only spidering first, so spoke lines end where the pin is drawn.
    // Never alters a peer's shared coordinates. "Me" is reserved so peers don't sit on it.
    const shownAt = new Map<string, import("leaflet").LatLng>();
    const occupied: Array<{ x: number; y: number }> = [];
    const meNode = nodes.find((n) => n.me);
    if (meNode) { const p = map.current.latLngToLayerPoint([meNode.lat, meNode.lon]); occupied.push({ x: p.x, y: p.y }); }
    for (const n of nodes) {
      if (n.me) continue;
      const point = map.current.latLngToLayerPoint([n.lat, n.lon]);
      let shifted = point;
      for (let ring = 0; ring < 8; ring++) {
        const candidates = ring === 0 ? [point] : Array.from({ length: ring * 8 }, (_, i) =>
          point.add(Lf.point(Math.cos(i * Math.PI / (ring * 4)) * ring * 19, Math.sin(i * Math.PI / (ring * 4)) * ring * 19)));
        const available = candidates.find((c) => occupied.every((p) => Math.hypot(c.x - p.x, c.y - p.y) >= 19));
        if (available) { shifted = available; break; }
      }
      occupied.push({ x: shifted.x, y: shifted.y });
      shownAt.set(n.from, map.current.layerPointToLatLng(shifted));
    }
    // Spokes always start at this handset (live fix) so direction is never
    // drawn from a stale home anchor; home anchor only when no live fix.
    const origin = positionSource !== "fallback" ? nodes[0] : homeAnchor ? { from: "HOME", lat: homeAnchor[0], lon: homeAnchor[1] } : null;
    if (origin) for (const b of nodes.filter((n) => !n.me).slice(0, 40)) {
        const a = origin;
        const d = distanceM(a, b);
        const linked = d <= WIFI_REACH_M * 2;
        const bHot = isHot(b.from);
        const active = isHot(a.from) || bHot;
        const end = shownAt.get(b.from) ?? Lf.latLng(b.lat, b.lon);
        // Draw in the direction of travel: talker → listener, so the dash animation flows the right way.
        const path: [number, number][] = bHot ? [[end.lat, end.lng], [a.lat, a.lon]] : [[a.lat, a.lon], [end.lat, end.lng]];
        const spoke = Lf.polyline(
          path,
          active
            ? { color: hot, weight: 4, opacity: 0.95, lineCap: "round", className: bHot ? "cb-tx-spoke-in" : "cb-tx-spoke-out" }
            : { color: linked ? sig : warn, weight: linked ? 2 : 1, dashArray: linked ? undefined : "3 6" },
        );
        spoke
          .bindTooltip(
            active
              ? `${bHot ? b.from : a.from} transmitting · map distance ~${Math.round(d)} m (not a verified link)`
              : `~${Math.round(d)} m · estimated separation, not a verified link`,
          )
          .addTo(g);
    }
    for (const n of nodes) {
      Lf.circle([n.lat, n.lon], {
        radius: WIFI_REACH_M,
        color: sig,
        weight: 1,
        dashArray: "2 4",
        fillOpacity: 0.04,
      }).addTo(g);
      if (!n.me) {
        const detail = document.createElement("span");
        detail.textContent = `${n.from} · ${n.source} ±${Math.round(n.acc)} m · pin offset on crowded maps`;
        const actual = Lf.latLng(n.lat, n.lon);
        const shown = shownAt.get(n.from) ?? actual;
        if (map.current.latLngToLayerPoint(shown).distanceTo(map.current.latLngToLayerPoint(actual)) > 2) Lf.polyline([actual, shown], { color: warn, weight: 1, dashArray: "2 4", opacity: 0.7 }).addTo(g);
        const palette = ["--warn", "--scan", "--rim-violet", "--rim-cyan", "--rim-orange", "--rim-green"];
        const hash = [...n.from].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
        const color = cs?.getPropertyValue(palette[hash % palette.length] ?? "--warn").trim() || warn;
        const marker = document.createElement("span");
        marker.className = "cb-squad-pin";
        marker.style.setProperty("--pin-color", color);
        marker.textContent = n.from.slice(0, 2).toUpperCase();
        Lf.marker(shown, { icon: Lf.divIcon({ html: marker, className: "cb-squad-pin-wrap", iconSize: [26, 26], iconAnchor: [13, 13] }) })
          .bindPopup(detail, { closeButton: true }).addTo(g);
      }
    }
    if (homeAnchor) Lf.circleMarker(homeAnchor, { radius: 7, color: sig, weight: 2, fillOpacity: 0.2 })
      .bindTooltip("Home anchor · local display only").addTo(g);
    g.addTo(map.current);
    squadLayer.current = g;
  }, [ready, squad, peers, pos, acc, callsign, positionSource, txHot, hotTick, scope, homeAnchor, zoom]);

  /* weather stations */
  useEffect(() => {
    if (online && showSt) void loadNwsStations(pos[0], pos[1]).catch(() => undefined);
  }, [online, showSt, pos]);
  useEffect(() => {
    if (!ready || !L.current || !map.current) return;
    stLayer.current?.remove();
    stLayer.current = null;
    if (!showSt) return;
    const g = L.current.layerGroup();
    const cs = host.current ? getComputedStyle(host.current) : null;
    const scan = cs?.getPropertyValue("--scan").trim() || "currentColor";
    const warn = cs?.getPropertyValue("--warn").trim() || "currentColor";
    const [mLat, mLon] = posRef.current.pos;
    for (const s of stList) {
      const label = s.id.split(":")[1] ?? s.name;
      const ageMin = Math.round((Date.now() - s.at) / 60_000);
      const adv = calculateAdvectionArrival(mLat, mLon, s);
      const eta = adv && adv.etaMin >= 0 && adv.etaMin <= 60 ? ` · here ~${Math.round(adv.etaMin)}m` : "";
      L.current
        .circleMarker([s.lat, s.lon], { radius: eta ? 8 : 5, color: s.source === "nws" ? scan : warn, weight: eta ? 3 : 2, fillOpacity: Math.max(0.15, Math.exp(-ageMin / 15) * 0.7) })
        .bindTooltip(`${label}${s.tempF != null ? ` ${Math.round(s.tempF)}°` : ""} · ${ageMin}m old${eta}`)
        .on("click", () => setPicked(s))
        .addTo(g);
    }
    g.addTo(map.current);
    stLayer.current = g;
  }, [ready, showSt, stList, pos]);

  /* conditions + alerts */
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);

  useEffect(() => {
    if (!online) return;
    const [lat, lon] = pos;
    let dead = false;
    const load = () => {
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,dew_point_2m,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`,
      )
        .then((r) => r.json())
        .then((j) => {
          const c = j?.current;
          if (dead || !c) return;
          setWx({
            t: c.temperature_2m,
            rh: c.relative_humidity_2m,
            dew: c.dew_point_2m,
            wind: c.wind_speed_10m,
            vpd: vpdKpa(c.temperature_2m, c.relative_humidity_2m),
          });
        })
        .catch(() => undefined);
      fetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, {
        headers: { Accept: "application/geo+json" },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (dead || !j?.features) return;
          setAlerts(
            (j.features as { id: string; properties: Alert }[])
              .map((f) => ({ ...f.properties, id: f.id }))
              .filter((a) => a.severity === "Severe" || a.severity === "Extreme"),
          );
        })
        .catch(() => undefined);
    };
    load();
    const t = window.setInterval(load, 10 * 60_000);
    return () => {
      dead = true;
      window.clearInterval(t);
    };
  }, [online, pos]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const stopFollow = () => setMacroFollow(false);
    m.on("dragstart", stopFollow);
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse && !fullMap) m.dragging.disable();
    else m.dragging.enable();
    return () => { m.off("dragstart", stopFollow); };
  }, [ready, fullMap]);

  return (
    <section className={`cb-map-section mt-1 w-full border border-border bg-background ${fullMap || docked ? "!m-0 flex min-h-0 flex-1 flex-col" : ""} ${docked && messageOpen ? "cb-map-message-open" : ""}`}>
      <div className={fullMap || docked ? "contents" : "cb-map-rail"}>
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background px-2 py-1 text-[14px] text-muted-foreground">
         <span className="min-w-0 truncate">{fullMap ? `${room} · ${squad ? `${visiblePeers.length} peers · ${squadStatus}` : "map"} · z${zoom}` : `FIELD MAP · ${room} · z${zoom}`}</span>
        <div className="flex shrink-0 items-center gap-2">
          <span role="status" aria-label={keyed ? "PTT transmitting" : "PTT idle"} title={keyed ? "PTT transmitting" : "PTT idle"} className={`cb-ptt-light ${keyed ? "cb-ptt-live" : ""}`} />
          <Button type="button" size="sm" variant="outline" onClick={() => onFullMapChange?.(!fullMap)} aria-label={fullMap ? "Return to radio controls" : "Expand map"}>{fullMap ? "Back to controls" : "Expand map"}</Button>
        </div>
      </div>
      {!fullMap && !docked && <div className="grid grid-cols-2 gap-1 border-b border-border p-1 text-[13px] max-[350px]:grid-cols-1">
        <div className="min-w-0">
          <Button type="button" size="sm" variant="ghost" className="h-auto px-1 text-signal" onClick={() => setShowSquadDetails((v) => !v)} aria-expanded={showSquadDetails}>Squad {showSquadDetails ? "▾" : "▸"}</Button>
          {showSquadDetails && <span className="break-words text-muted-foreground">{squad ? `${squadStatus} · ${positionSource === "fallback" ? "position unavailable" : `${positionSource} ±${Math.round(acc)}m · ${Math.round((Date.now() - locationAge) / 60000)}m old`}${reckon?.source === "inertial" ? ` · ${reckon.steps} steps · no sat` : ""}` : "not sharing"}</span>}
        </div>
        <div className="min-w-0">
          <Button type="button" size="sm" variant="ghost" className="h-auto px-1 text-signal" onClick={() => setShowWeather((v) => !v)} aria-expanded={showWeather}>Weather {showWeather ? "▾" : "▸"}</Button>
          {showWeather && <span className="break-words text-muted-foreground">{!online ? "off net · map from cache" : wx ? `${fckShort(wx.t)} · dew ${fckShort(wx.dew)} · RH ${Math.round(wx.rh)}% · wind ${Math.round(wx.wind)} mph · VPD ${wx.vpd.toFixed(2)}` : "reading conditions…"}</span>}
          {showWeather && (() => {
            const b = positionSource === "fallback" ? null : blendStations(pos[0], pos[1], stList);
            if (!b) return <span className="block text-muted-foreground">stations · none heard nearby</span>;
            return <>
              <span className="block break-words text-muted-foreground">stations · {b.count} heard · avg {b.avgMiles.toFixed(1)} mi · {b.ageMin}m old{b.tempF != null ? ` · blend ${fckShort(b.tempF)}` : ""}{b.pressureHpa != null ? ` · ${b.pressureHpa.toFixed(1)} hPa` : ""}</span>
              {b.incoming && <span role="status" className="block font-bold text-warn">⚠ upwind {b.incoming.id.replace(/^\w+:/, "")} arriving ~{b.incoming.etaMin} min{b.incoming.gustMph != null ? ` · gust ${Math.round(b.incoming.gustMph)} mph` : ""}</span>}
            </>;
          })()}
        </div>
      </div>}
      {!fullMap && !(docked && messageOpen) && <div className={`flex gap-1 border-b border-border bg-background p-1 ${docked ? "shrink-0 overflow-x-auto whitespace-nowrap" : "flex-wrap"}`}>
        {(["street", "topo", "sat"] as Base[]).map((b) => <Button key={b} type="button" size="sm" variant={base === b ? "default" : "outline"} onClick={() => setBase(b)}>{b}</Button>)}
        <Button type="button" size="sm" variant={dopp ? "default" : "outline"} onClick={() => setDopp((v) => !v)}>Doppler</Button>
        <Button type="button" size="sm" variant={apex ? "default" : "outline"} onClick={() => setApex((v) => !v)}>Signal</Button>
        <Button type="button" size="sm" variant={showSt ? "default" : "outline"} onClick={() => setShowSt((v) => !v)}>Stations</Button>
        <Button type="button" size="sm" variant={squad ? "default" : "outline"} onClick={() => setSquad((v) => !v)}>Squad {squad ? Object.keys(peers).length : ""}</Button>
        {squad && <Button type="button" size="sm" variant="outline" onClick={() => setManualMode((v) => !v)}>{manualMode ? "Tap map" : "Set pin"}</Button>}
      </div>}
      </div>
      {!fullMap && !docked && <Button type="button" variant="ghost" size="sm" onClick={onDockMap} className="w-full shrink-0 text-signal" aria-label="Open map beneath radio controls">Open map beneath radio controls ↑</Button>}
       {!(docked && messageOpen) && <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-2 py-1 text-[12px] text-muted-foreground">
          <select value={scope} onChange={(event) => chooseScope(event.target.value as MapScope)} aria-label="Map connection range" className="h-7 min-w-0 flex-1 border border-border bg-card px-2 text-[12px] text-foreground">
            {(Object.keys(MAP_SCOPE) as MapScope[]).map((s) => <option key={s} value={s}>{MAP_SCOPE[s].label}</option>)}
          </select>
         <Button type="button" size="sm" variant={homeAnchor ? "default" : "outline"} className="h-7 shrink-0 px-2 text-[12px]" disabled={positionSource === "fallback" && !homeAnchor} aria-label={homeAnchor ? "Unlock home map anchor" : "Lock map to current position as home"} aria-pressed={!!homeAnchor} onClick={() => { setHomeAnchor(homeAnchor ? null : pos); setMacroFollow(false); }}>{homeAnchor ? "Home locked" : "Lock home"}</Button>
         <Button type="button" size="sm" variant={macroFollow ? "default" : "outline"} className="h-7 shrink-0 px-2 text-[12px]" aria-label={macroFollow ? "Stop following handset on connection map" : "Follow handset on connection map"} aria-pressed={macroFollow} onClick={() => { setMacroFollow((v) => !v); if (homeAnchor) setHomeAnchor(null); }}>{macroFollow ? "Follow on" : "Follow off"}</Button>
      </div>}
      {!fullMap && (alerts.length > 0 || radio.length > 0) && <div className="border-b border-alert bg-background px-2 py-1 text-[14px] text-alert" role="alert">
        {online && alerts.slice(0, 2).map((a) => <p key={a.id} className="break-words">⚠ {a.event} — {a.headline}</p>)}
        {radio.slice(0, 2).map((a) => <p key={a.id} className="break-words">⚠ radio · {a.event} {a.area ? `— ${a.area}` : ""}</p>)}
      </div>}
      <div className={`cb-map-viewport relative overflow-hidden bg-background ${fullMap || docked ? "min-h-0 flex-1" : "h-[320px] sm:h-[min(50vh,500px)]"}`}>
      <div ref={host} className="cb-map-host absolute inset-0 z-0 bg-background" />

      {picked ? (
        <div className="absolute left-1/2 top-1/2 z-[600] w-64 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-signal bg-background/95 p-2 text-[16px] uppercase tracking-wider text-foreground">
          <div className="mb-1 flex items-start justify-between gap-2">
            <b className="text-signal">{picked.name}</b>
            <Button type="button" size="icon" variant="ghost" aria-label="close" onClick={() => setPicked(null)} className="text-muted-foreground">×</Button>
          </div>
          <p className="text-muted-foreground">{picked.source === "nws" ? "official station" : "ham radio station"} · {milesBetween(pos[0], pos[1], picked.lat, picked.lon).toFixed(1)} mi · {Math.round((Date.now() - picked.at) / 60000)} min old</p>
          {picked.tempF != null ? <p>temp {fck(picked.tempF, 0)}</p> : null}
          {picked.dewF != null ? <p>dew {fck(picked.dewF, 0)}</p> : null}
          {picked.rh != null ? <p>humidity {Math.round(picked.rh)}%</p> : null}
          {picked.windMph != null ? <p>wind {Math.round(picked.windMph)} mph{picked.windDir != null ? ` from ${Math.round(picked.windDir)}°` : ""}{picked.gustMph != null ? ` · gust ${Math.round(picked.gustMph)}` : ""}</p> : null}
          {picked.pressureHpa != null ? <p>pressure {picked.pressureHpa.toFixed(1)} hPa</p> : null}
          {picked.rainIn != null ? <p>rain {picked.rainIn.toFixed(2)} in</p> : null}
        </div>
      ) : null}

      {/* zoom / locate controls */}
      <div className="absolute bottom-1 right-1 z-[500] flex flex-col gap-1">
        <Button type="button" size="icon" variant="outline" aria-label="zoom in" title="Zoom in" onClick={() => map.current?.zoomIn()} className="h-9 w-9 text-[20px] text-foreground">
          +
        </Button>
        <Button type="button" size="icon" variant="outline" aria-label="zoom out" title="Zoom out" onClick={() => map.current?.zoomOut()} className="h-9 w-9 text-[20px] text-foreground">
          −
        </Button>
        <Button type="button" size="icon" variant={fix ? "default" : "outline"} aria-label="center on me" title="Center on me" onClick={locate} className="h-9 w-9 text-[20px]">
          ◎
        </Button>
      </div>

      </div>
    </section>
  );
}
