import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type MapSearch = { lat?: number | undefined; lon?: number | undefined };

function parseCoord(value: unknown, min: number, max: number): number | undefined {
  const parsed = Number(typeof value === "string" || typeof value === "number" ? value : NaN);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

export const Route = createFileRoute("/map")({
  validateSearch: (s: Record<string, unknown>): MapSearch => {
    return {
      lat: parseCoord(s["lat"], -90, 90),
      lon: parseCoord(s["lon"], -180, 180),
    };
  },
  head: () => ({
    meta: [
      { title: "Forecast Map — TinyRadr" },
      {
        name: "description",
        content: "Tap the map to pick a forecast location and open a 62-day wave outlook.",
      },
      { property: "og:title", content: "Forecast Map — TinyRadr" },
      { property: "og:description", content: "Pick a location on the TinyRadr map for a local forecast." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForecastMapRoute,
});

function ForecastMapRoute() {
  const search = Route.useSearch();
  const initialLat = search.lat ?? 44.98;
  const initialLon = search.lon ?? -84.6;
  const [lat, setLat] = useState(initialLat);
  const [lon, setLon] = useState(initialLon);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").CircleMarker | null>(null);

  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") return;
    let alive = true;
    let dispose: (() => void) | null = null;

    void import("leaflet").then((L) => {
      if (!alive || !mapRef.current) return;
      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([initialLat, initialLon], 6);
      mapInstanceRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 17 }).addTo(map);

      const marker = L.circleMarker([initialLat, initialLon], {
        radius: 7,
        color: "var(--signal)",
        fillColor: "var(--signal)",
        fillOpacity: 0.75,
      }).addTo(map);
      markerRef.current = marker;

      const onPick = (nextLat: number, nextLon: number) => {
        setLat(nextLat);
        setLon(nextLon);
        marker.setLatLng([nextLat, nextLon]);
      };

      map.on("click", (evt) => onPick(evt.latlng.lat, evt.latlng.lng));
      dispose = () => {
        markerRef.current = null;
        mapInstanceRef.current = null;
        map.remove();
      };
    });

    return () => {
      alive = false;
      dispose?.();
    };
  }, [initialLat, initialLon]);

  useEffect(() => {
    markerRef.current?.setLatLng([lat, lon]);
    mapInstanceRef.current?.setView([lat, lon], mapInstanceRef.current.getZoom(), {
      animate: true,
    });
  }, [lat, lon]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude);
      setLon(pos.coords.longitude);
    });
  };

  return (
    <main className="flex h-app flex-col overflow-hidden scan-grid face-pad pb-3 pt-2">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Link to="/forecast" search={{ lat, lon }} className="text-[10px] text-muted-foreground">
          ‹
        </Link>
        <h1 className="truncate text-center text-[10px] font-bold uppercase tracking-[0.2em] text-signal">
          Forecast Map
        </h1>
        <span className="text-[7px] uppercase tracking-widest text-muted-foreground">leaflet</span>
      </header>

      <div className="mt-2 rounded-sm border border-border bg-card/60 p-2 text-[8px] uppercase tracking-widest text-muted-foreground">
        tap to set location · {lat.toFixed(3)}, {lon.toFixed(3)}
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <div ref={mapRef} className="min-h-0 flex-1 rounded-sm border border-scan/50" />
      </div>

      <div className="mt-2 grid shrink-0 grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={useCurrentLocation}
          className="rounded-sm border border-warn/60 py-1.5 text-[8px] uppercase tracking-widest text-warn"
        >
          use gps
        </button>
        <Link
          to="/forecast"
          search={{ lat, lon }}
          className="rounded-sm border border-signal/60 py-1.5 text-center text-[8px] uppercase tracking-widest text-signal"
        >
          open forecast
        </Link>
      </div>
    </main>
  );
}
