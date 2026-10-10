import { createFileRoute, Link } from "@tanstack/react-router";
import AppTopBar from "@/components/AppTopBar";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { correlationLabel } from "@/lib/astro";
import SkyCompass from "@/components/SkyCompass";

/**
 * Solar, lunar and seismic inputs, graphed against the local temperature
 * record, with the cross-correlation printed in plain language.
 */

type AstroDay = {
  date: string;
  temp_f: number | null;
  solar: number | null;
  pressure: number | null;
  lunar: number | null;
  seismic: number;
  moon: string;
};

type Correlation = { r: number; n: number };

type AstroPayload = {
  location: { lat: number; lon: number };
  days: AstroDay[];
  quakes: Array<{ time: string; mag: number; place: string; km: number }>;
  correlations: {
    solar_temp: Correlation;
    lunar_temp: Correlation;
    seismic_pressure: Correlation;
    seismic_temp: Correlation;
  };
  moon_today: { phase: number; illumination: number; label: string };
  generated_at: string;
};

export const Route = createFileRoute("/astro")({
  component: AstroPage,
  head: () => ({
    meta: [
      { title: "Solar, Lunar & Seismic Inputs — Enphase Operator" },
      {
        name: "description",
        content:
          "Daily solar radiation, lunar phase and nearby seismic energy graphed against the local temperature record, with cross-correlations.",
      },
      { property: "og:title", content: "Solar, Lunar & Seismic Inputs — Enphase Operator" },
      {
        property: "og:description",
        content:
          "Almanac-style astro inputs cross-correlated with local weather readings and nearby earthquakes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const DEFAULT = { lat: 44.98, lon: -84.6 };

function AstroPage() {
  const [pos, setPos] = useState(DEFAULT);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setPos({
          lat: Number(p.coords.latitude.toFixed(3)),
          lon: Number(p.coords.longitude.toFixed(3)),
        }),
      () => undefined,
      { maximumAge: 600000, timeout: 8000 },
    );
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["astro", pos.lat, pos.lon],
    queryFn: async (): Promise<AstroPayload> => {
      // Phone pulls the feed itself (its own connection isn't rate-limited).
      let daily: unknown;
      try {
        const q = new URLSearchParams({
          latitude: String(pos.lat),
          longitude: String(pos.lon),
          daily: "temperature_2m_mean,shortwave_radiation_sum,surface_pressure_mean",
          temperature_unit: "fahrenheit",
          past_days: "90",
          forecast_days: "16",
          timezone: "UTC",
        });
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q.toString()}`);
        if (r.ok) daily = ((await r.json()) as { daily?: unknown }).daily;
        if (!daily) {
          // Second source: MET Norway, re-shaped to the same payload.
          const mn = await import("@/lib/conditions-metno");
          daily = mn.metNoAsOpenMeteoDaily(await mn.fetchMetNo(pos.lat, pos.lon)).daily;
        }
      } catch {
        /* server will try */
      }
      const res = await fetch(`/api/public/astro?lat=${pos.lat}&lon=${pos.lon}&past=90`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily }),
      });
      if (!res.ok) throw new Error("astro inputs unavailable");
      return (await res.json()) as AstroPayload;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Everything is put on one scale so the shapes can be compared by eye.
  const chart = (data?.days ?? []).map((d) => ({
    date: d.date.slice(5),
    temp: d.temp_f,
    solar: d.solar,
    lunar: d.lunar === null ? null : Number((d.lunar * 50 + 50).toFixed(1)),
    seismic: d.seismic > 0 ? Number((d.seismic * 10).toFixed(1)) : null,
  }));

  const rows: Array<[string, Correlation, string]> = data
    ? [
        ["Solar vs temperature", data.correlations.solar_temp, "sunlight driving the air"],
        ["Lunar vs temperature", data.correlations.lunar_temp, "almanac moon term"],
        ["Seismic vs pressure", data.correlations.seismic_pressure, "ground vs air mass"],
        ["Seismic vs temperature", data.correlations.seismic_temp, "ground vs warmth"],
      ]
    : [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <AppTopBar title="Solar · Lunar · Seismic" backTo="/wx" storageKey="astro" />

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Daily sunlight, the moon term and the energy released by nearby ground movement, drawn
        against the local temperature record. Correlation is not cause — this panel shows which
        inputs are actually moving with the weather here, so you can see what the engine is
        weighing.
      </p>

      <div className="mt-4">
        <SkyCompass lat={pos.lat} lon={pos.lon} />
      </div>

      {isLoading ? (
        <p className="mt-6 text-[11px] uppercase tracking-widest text-muted-foreground">
          reading feeds…
        </p>
      ) : error ? (
        <p className="mt-6 rounded-sm border border-warn/60 p-3 text-[11px] uppercase tracking-widest text-warn">
          These inputs are unavailable right now. The forecast does not depend on them.
        </p>
      ) : (
        <>
          <section className="mt-4 rounded-sm border border-border bg-card/60 p-3">
            <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
              Moon today · {data?.moon_today.label} ·{" "}
              {Math.round((data?.moon_today.illumination ?? 0) * 100)}% lit
            </p>

            {/* Sun anchored left, moon travelling right: the gap between them is
                the elongation, so a full moon sits opposite the sun. */}
            <div className="relative mt-3 h-8 rounded-sm border border-border/60 bg-background">
              <div className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-border" />
              <span
                className="absolute top-1/2 -translate-y-1/2 text-[10px] text-warn"
                style={{ left: "6px" }}
                title="Sun"
              >
                ☀
              </span>
              <span
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-scan"
                style={{ left: `${8 + (data?.moon_today.phase ?? 0) * 84}%` }}
                title="Moon"
              >
                ☾
              </span>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[7px] uppercase tracking-widest text-muted-foreground">
                opposite
              </span>
            </div>
            <p className="mt-1 text-[8px] uppercase tracking-widest text-muted-foreground">
              separation {Math.round((data?.moon_today.phase ?? 0) * 360)}° · sun fixed left, moon
              walks right until it stands opposite at full
            </p>

            <div className="mt-2 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
                  <XAxis dataKey="date" tick={{ fontSize: 8 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 8 }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      fontSize: 10,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="temp"
                    name="temp °F"
                    stroke="var(--signal)"
                    dot={false}
                    strokeWidth={1.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="solar"
                    name="solar MJ/m²"
                    stroke="var(--warn)"
                    dot={false}
                    strokeWidth={1}
                  />
                  <Line
                    type="monotone"
                    dataKey="lunar"
                    name="moon"
                    stroke="var(--scan)"
                    dot={false}
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                  <Line
                    type="monotone"
                    dataKey="seismic"
                    name="seismic"
                    stroke="var(--alert)"
                    dot={{ r: 1.5 }}
                    strokeWidth={0}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="mt-3 grid gap-2 sm:grid-cols-2">
            {rows.map(([label, c, note]) => (
              <div key={label} className="rounded-sm border border-border bg-card/60 p-3">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-sm text-signal">{c.r.toFixed(2)}</p>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  {correlationLabel(c.r)} · {c.n} days · {note}
                </p>
              </div>
            ))}
          </section>

          <section className="mt-3 rounded-sm border border-border bg-card/60 p-3">
            <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
              Ground movement, last 30 days
            </p>
            {data && data.quakes.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {data.quakes.slice(0, 8).map((q) => (
                  <li
                    key={`${q.time}-${q.place}`}
                    className="flex justify-between gap-2 text-[9px] uppercase tracking-widest text-muted-foreground"
                  >
                    <span className="truncate">
                      M{q.mag.toFixed(1)} · {q.place}
                    </span>
                    <span className="shrink-0 text-signal">{q.km} km</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">
                nothing above M1.5 within range
              </p>
            )}
          </section>
        </>
      )}

      <p className="mt-4 text-[8px] uppercase tracking-widest text-muted-foreground">
        Public data only — sunlight and temperature from the open weather archive, quakes from the
        public seismic feed, moon computed on the device. No key, no account.
      </p>
    </main>
  );
}
