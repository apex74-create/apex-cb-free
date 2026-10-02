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
  callsign = "",
  keyed = false,
}: {
  room?: string;
  roomKey?: CryptoKey | null;
  callsign?: string;
  keyed?: boolean;
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
  const [squad, setSquad] = useState(false);
  const [showSt, setShowSt] = useState(true);
  const [stList, setStList] = useState<StationObs[]>([]);
  const [radio, setRadio] = useState<RadioAlert[]>([]);
  const [picked, setPicked] = useState<StationObs | null>(null);
  const [zoom, setZoom] = useState(12);
  const [fullMap, setFullMap] = useState(false);
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
  }, [squad, room, roomKey, callsign]);

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
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", refresh); };
  }, [ready, fullMap]);

  /* position */
  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setPos([p.coords.latitude, p.coords.longitude]);
        setAcc(p.coords.accuracy);
        setFix(true);
        setPositionSource("browser");
        setLocationAge(Date.now());
        map.current?.setView([p.coords.latitude, p.coords.longitude], 14);
      },
      () => { if (positionSource === "fallback") setFix(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };
  useEffect(() => {
    if (ready) locate();
  }, [ready]);

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
    const nodes = [
      ...(positionSource === "fallback" ? [] : [{ from: callsign || "YOU", lat: pos[0], lon: pos[1], acc, me: true, source: positionSource }]),
      ...Object.values(peers).map((p) => ({ ...p, me: false })),
    ];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const d = distanceM(a, b);
        const linked = d <= WIFI_REACH_M * 2;
        Lf.polyline(
          [
            [a.lat, a.lon],
            [b.lat, b.lon],
          ],
          { color: linked ? sig : warn, weight: linked ? 2 : 1, dashArray: linked ? undefined : "3 6" },
        )
          .bindTooltip(`~${Math.round(d)} m · ${linked ? "estimated rings intersect" : "out of estimated reach"}`)
          .addTo(g);
      }
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
        detail.textContent = `${n.from} · ${n.source} ±${Math.round(n.acc)} m`;
        Lf.circleMarker([n.lat, n.lon], { radius: 6, color: warn, weight: 2, fillOpacity: 0.9 })
          .bindPopup(detail, { closeButton: true })
          .addTo(g);
      }
    }
    g.addTo(map.current);
    squadLayer.current = g;
  }, [ready, squad, peers, pos, acc, callsign, positionSource]);

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

  return (
    <section className={`cb-map-section mt-1 w-full border border-border bg-background ${fullMap ? "fixed inset-0 z-[1000] !m-0 flex h-dvh flex-col" : ""}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background px-2 py-1 text-[14px] text-muted-foreground">
        <span className="min-w-0 truncate">{fullMap ? `${room} · ${squad ? `${Object.keys(peers).length} peers · ${squadStatus}` : "map"} · z${zoom}` : `FIELD MAP · z${zoom}`}</span>
        <div className="flex shrink-0 items-center gap-2">
          <span role="status" aria-label={keyed ? "PTT transmitting" : "PTT idle"} title={keyed ? "PTT transmitting" : "PTT idle"} className={`cb-ptt-light ${keyed ? "cb-ptt-live" : ""}`} />
          <Button type="button" size="sm" variant="outline" onClick={() => setFullMap((v) => !v)} aria-label={fullMap ? "Exit full map" : "Full map"}>{fullMap ? "Exit" : "Full map"}</Button>
        </div>
      </div>
      {!fullMap && <div className="grid grid-cols-2 gap-1 border-b border-border p-1 text-[13px] max-[350px]:grid-cols-1">
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
      {!fullMap && <div className="flex flex-wrap gap-1 border-b border-border bg-background p-1">
        {(["street", "topo", "sat"] as Base[]).map((b) => <Button key={b} type="button" size="sm" variant={base === b ? "default" : "outline"} onClick={() => setBase(b)}>{b}</Button>)}
        <Button type="button" size="sm" variant={dopp ? "default" : "outline"} onClick={() => setDopp((v) => !v)}>Doppler</Button>
        <Button type="button" size="sm" variant={apex ? "default" : "outline"} onClick={() => setApex((v) => !v)}>Signal</Button>
        <Button type="button" size="sm" variant={showSt ? "default" : "outline"} onClick={() => setShowSt((v) => !v)}>Stations</Button>
        <Button type="button" size="sm" variant={squad ? "default" : "outline"} onClick={() => setSquad((v) => !v)}>Squad {squad ? Object.keys(peers).length : ""}</Button>
        {squad && <Button type="button" size="sm" variant="outline" onClick={() => setManualMode((v) => !v)}>{manualMode ? "Tap map" : "Set pin"}</Button>}
      </div>}
      {!fullMap && (alerts.length > 0 || radio.length > 0) && <div className="border-b border-alert bg-background px-2 py-1 text-[14px] text-alert" role="alert">
        {online && alerts.slice(0, 2).map((a) => <p key={a.id} className="break-words">⚠ {a.event} — {a.headline}</p>)}
        {radio.slice(0, 2).map((a) => <p key={a.id} className="break-words">⚠ radio · {a.event} {a.area ? `— ${a.area}` : ""}</p>)}
      </div>}
      <div className={`relative min-h-[320px] overflow-hidden bg-background ${fullMap ? "min-h-0 flex-1" : "aspect-square"}`}>
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
