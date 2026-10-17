import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getLocalView, subscribeLocalView, MICRO_RADIUS_M, type LocalMapView } from "@/lib/local-map-view";
import { distanceM } from "@/lib/squad-positions";

/** A second, local-only viewport. Never guesses a position if permission is denied. */
export function CbNodeInset({ position, accuracy }: { position: [number, number] | null; accuracy: number | null }) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const marker = useRef<import("leaflet").CircleMarker | null>(null);
  const uncertainty = useRef<import("leaflet").Circle | null>(null);
  const [follow, setFollow] = useState(true);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<LocalMapView>(getLocalView);
  useEffect(() => subscribeLocalView(() => setView(getLocalView())), []);
  const nearLayer = useRef<import("leaflet").LayerGroup | null>(null);
  const centre = view.home ?? position;
  const near = centre ? view.peers.filter((p) => distanceM({ lat: centre[0], lon: centre[1] }, p) <= MICRO_RADIUS_M) : [];
  const current = useRef(position);
  current.current = position;

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !host.current || map.current) return;
      const m = L.map(host.current, { zoomControl: false, attributionControl: false, maxZoom: 19 })
        .setView(current.current ?? [45, -84.66], 19);
      // On touchscreens, vertical swipes scroll the right-hand radio panel.
      if (window.matchMedia("(pointer: coarse)").matches) m.dragging.disable();
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxNativeZoom: 19, maxZoom: 19, errorTileUrl: "", className: "cb-map-tiles" }).addTo(m);
      m.on("dragstart", () => setFollow(false));
      map.current = m;
      setReady(true);
    });
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !position) return;
    // Layer constructors are loaded only on the client with the map.
    void import("leaflet").then((leaflet) => {
      if (map.current !== m) return;
      const color = host.current ? getComputedStyle(host.current).getPropertyValue("--signal").trim() : "";
      const pointColor = color || "currentColor";
      if (!marker.current) marker.current = leaflet.circleMarker(position, { radius: 8, color: pointColor, weight: 3, fillOpacity: 0.75 }).addTo(m);
      else marker.current.setLatLng(position);
      if (accuracy != null) {
        if (!uncertainty.current) uncertainty.current = leaflet.circle(position, { radius: accuracy, color: pointColor, weight: 1, fillOpacity: 0.05 }).addTo(m);
        else uncertainty.current.setLatLng(position).setRadius(accuracy);
      }
      if (follow) m.setView(position, 19, { animate: false });
    });
  }, [position, accuracy, ready, follow]);

  // Home access point + nearby people in the current room only. Town-range peers stay on the wide map.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    void import("leaflet").then((Lf) => {
      if (map.current !== m) return;
      nearLayer.current?.remove();
      const cs = host.current ? getComputedStyle(host.current) : null;
      const sig = cs?.getPropertyValue("--signal").trim() || "currentColor";
      const warn = cs?.getPropertyValue("--warn").trim() || "currentColor";
      const g = Lf.layerGroup();
      if (view.home) {
        Lf.circleMarker(view.home, { radius: 9, color: sig, weight: 2, fillOpacity: 0.25 }).bindTooltip("Home access point · local only").addTo(g);
        Lf.circle(view.home, { radius: MICRO_RADIUS_M, color: sig, weight: 1, dashArray: "2 4", fillOpacity: 0.02 }).addTo(g);
      }
      for (const p of near) {
        if (view.home) Lf.polyline([view.home, [p.lat, p.lon]], { color: sig, weight: 1, opacity: 0.7 }).addTo(g);
        Lf.circleMarker([p.lat, p.lon], { radius: 6, color: warn, weight: 2, fillOpacity: 0.6 })
          .bindTooltip(`${p.from} · ${p.source} ±${Math.round(p.acc)} m · estimate`).addTo(g);
      }
      g.addTo(m);
      nearLayer.current = g;
    });
  }, [ready, view, near.length, position]);

  useEffect(() => {
    if (!ready || !host.current) return;
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [ready]);

  return <section className="cb-node-inset min-w-0 border border-border bg-background" aria-label="Close-up of this handset's observed position">
    <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1 text-[12px] uppercase text-muted-foreground">
      <span className="shrink-0 text-foreground">This handset</span>
      <span className="min-w-0 truncate">{view.home ? `home · ${near.length} near · ` : ""}{position ? accuracy != null ? `browser ±${Math.round(accuracy)}m` : "browser position" : "awaiting position"}</span>
      <Button size="sm" type="button" variant={follow ? "default" : "outline"} aria-label={follow ? "Stop following handset in close-up map" : "Follow handset in close-up map"} aria-pressed={follow} onClick={() => setFollow((v) => !v)} className="h-7 shrink-0 text-[12px]">{follow ? "Follow on" : "Follow off"}</Button>
    </div>
    <div className="relative min-h-0 flex-1 bg-background">
      <div ref={host} className="cb-map-host absolute inset-0" />
      {!position && <div className="absolute inset-0 grid place-items-center bg-background/90 p-3 text-center text-[12px] text-muted-foreground">Allow location to see this handset. No position inferred.</div>}
    </div>
  </section>;
}