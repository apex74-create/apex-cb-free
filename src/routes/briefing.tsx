import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchWaveForecast, type WaveForecastResponse } from "@/services/forecastApi";
import { sweepDevice, sweepParams, sweepSupported } from "@/lib/device-sensors";

/**
 * Meteorologist briefing — the whole run on one printable sheet.
 *
 * Built for a forecaster reading it cold: plain-English synopsis first, then
 * the numbers behind it (peak, confidence, analog years, microclimate
 * correction, crop pathogen pressure), every temperature in F, C and K.
 */

const DEFAULT_LAT = 44.98;
const DEFAULT_LON = -84.6;

type Search = { lat?: number | undefined; lon?: number | undefined };

export const Route = createFileRoute("/briefing")({
  component: BriefingRoute,
  validateSearch: (search: Record<string, unknown>): Search => {
    const num = (v: unknown, lim: number) => {
      const n = Number(v);
      return Number.isFinite(n) && Math.abs(n) <= lim ? n : undefined;
    };
    return { lat: num(search["lat"], 90), lon: num(search["lon"], 180) };
  },
  head: () => ({
    meta: [
      { title: "Forecast Briefing — Enphase Operator" },
      {
        name: "description",
        content:
          "A printable forecast briefing: plain-English synopsis, peak date and confidence, analog years, microclimate correction and crop pathogen pressure, in F, C and K.",
      },
      { property: "og:title", content: "Forecast Briefing — Enphase Operator" },
      {
        property: "og:description",
        content:
          "One printable sheet: synopsis, peak date, confidence, analog years, microclimate correction and mold index.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function triple(f: number | null | undefined): string {
  if (typeof f !== "number") return "--";
  const c = ((f - 32) * 5) / 9;
  return `${f.toFixed(1)}°F · ${c.toFixed(1)}°C · ${(c + 273.15).toFixed(1)} K`;
}

function longDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });
}

function synopsis(data: WaveForecastResponse): string[] {
  const m = data.metadata;
  const lines: string[] = [];
  const anomaly =
    typeof m.peak_anomaly === "number"
      ? `${Math.abs(m.peak_anomaly).toFixed(1)}°F ${m.peak_anomaly >= 0 ? "above" : "below"} normal`
      : "near normal";

  lines.push(
    `The run places the warm peak on ${longDate(m.peak_date)}, reaching ${triple(
      m.peak_intensity,
    )} — ${anomaly} — at ${Math.round(m.confidence_score * 100)}% confidence under a ${m.enso_state} ocean state.`,
  );

  if (m.window) {
    lines.push(
      `The elevated window runs ${longDate(m.window.start)} through ${longDate(
        m.window.end,
      )}${
        typeof m.window_days_above_normal === "number"
          ? `, holding ${m.window_days_above_normal} days above normal`
          : ""
      }.`,
    );
  }

  if (m.analog_years?.length) {
    const years = m.analog_years
      .slice(0, 5)
      .map((a) => a.year)
      .join(", ");
    lines.push(
      `Ocean-state analogs driving the shape: ${years}${
        typeof m.analog_agreement === "number"
          ? ` (${Math.round(m.analog_agreement * 100)}% agreement between them)`
          : ""
      }.`,
    );
  }

  if (m.anchored) {
    lines.push(
      `Anchored to ${m.observations_used ?? 0} measured days${
        typeof m.measurement_correction === "number" && m.measurement_correction !== 0
          ? `; the forward curve was shifted ${m.measurement_correction > 0 ? "+" : ""}${m.measurement_correction.toFixed(1)}°F to sit on the last measured readings`
          : ""
      }.`,
    );
  }

  const micro = m.microclimate;
  if (micro && typeof micro.level_shift === "number" && micro.level_shift !== 0) {
    const water = micro.water_bodies?.[0];
    lines.push(
      `Microclimate correction ${micro.level_shift > 0 ? "+" : ""}${micro.level_shift.toFixed(
        1,
      )}°F${
        water
          ? `, dominated by ${water.name} at ${Math.round(water.distance_mi)} miles upwind on a ${Math.round(micro.wind_from_deg ?? 0)}° flow`
          : ""
      }.`,
    );
  }

  const mold = m.microclimate_mold_index;
  if (mold) {
    lines.push(
      `Crop pathogen pressure peaks at ${mold.max_botrytis_spore_risk_pct.toFixed(
        1,
      )}% Botrytis germination risk with a mean vapour pressure deficit of ${mold.average_vpd_kpa.toFixed(
        2,
      )} kPa — ${mold.status_code.replace(/_/g, " ").toLowerCase()}.`,
    );
  }

  if (m.reset_node) {
    lines.push(
      `A thermal reset on ${longDate(m.reset_node.iso.slice(0, 10))} at ${triple(
        m.reset_node.temp,
      )} precedes the rebound${
        typeof m.rebound_days === "number" ? ` by ${m.rebound_days} days` : ""
      }.`,
    );
  }

  const future = (data.turning_points ?? []).filter(p => p.kind === "peak" && p.iso >= new Date().toISOString().slice(0, 10)).slice(0, 5);
  if (future.length) lines.push(`Projected turning-point peaks: ${future.map(p => `${longDate(p.iso.slice(0, 10))} ${triple(p.temp)}`).join("; ")}. These are model projections, not observations.`);
  const nights = m.nightly_lows?.nights.filter(n => n.iso >= new Date().toISOString().slice(0, 10)).slice(0, 7) ?? [];
  if (nights.length) lines.push(`Projected overnight shelter-height lows: ${nights.map(n => `${longDate(n.iso)} ${triple(n.low_f)}`).join("; ")}. Frost exposure at ground level may differ; these are not measured lows.`);
  if (m.ternary) lines.push(`3/6/9 consensus: ${m.ternary.state} · ${m.ternary.label} · ${Math.round(m.ternary.agreement * 100)}% agreement from ${m.ternary.witnesses} witnesses.`);

  return lines;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1">
      <dt className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="text-right text-[10px] text-foreground">{value}</dd>
    </div>
  );
}

function BriefingRoute() {
  const search = Route.useSearch();
  const lat = search.lat ?? DEFAULT_LAT;
  const lon = search.lon ?? DEFAULT_LON;
  const [data, setData] = useState<WaveForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [runDay, setRunDay] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const timer = window.setInterval(() => {
      const day = new Date().toISOString().slice(0, 10);
      setRunDay(old => old === day ? old : day);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    setError(null);
    setData(null);
    setIssued(null);
    void (async () => {
      const sensor = sweepSupported() ? sweepParams(await sweepDevice()) : {};
      const result = await fetchWaveForecast({ lat, lon, days: 365, past: 92, sensor, signal: abort.signal });
      if (!abort.signal.aborted) { setData(result); setIssued(new Date().toISOString()); }
    })().catch((e: unknown) => { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "briefing unavailable"); });
    return () => abort.abort();
  }, [lat, lon, refresh, runDay]);

  const lines = useMemo(() => (data ? synopsis(data) : []), [data]);
  const meta = data?.metadata;
  const mold = meta?.microclimate_mold_index;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 print:max-w-none print:px-0">
      <header className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
            Apex Air Solutions · Enphase Operator
          </p>
          <h1 className="mt-1 text-base font-bold uppercase tracking-[0.2em] text-signal">
            Forecast Briefing
          </h1>
          <p className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">
            {lat.toFixed(3)}, {lon.toFixed(3)} · {issued ? `retrieved ${issued.slice(0, 16).replace("T", " ")} UTC` : "refreshing run"}
          </p>
        </div>
        <div className="flex gap-2 print:hidden"><button type="button" onClick={() => setRefresh(v => v + 1)} className="app-hbtn px-3 py-1.5 text-[9px] uppercase">Refresh</button><button
          type="button"
          onClick={() => { if (data && issued && !error && issued.slice(0, 10) === new Date().toISOString().slice(0, 10)) window.print(); }}
          disabled={!data || !issued || !!error || issued.slice(0, 10) !== runDay}
          className="rounded-full border border-signal/60 bg-signal/10 px-3 py-1.5 text-[9px] uppercase tracking-widest text-signal print:hidden"
        >
          Print / PDF
        </button></div>
      </header>

      {error ? (
        <p className="mt-4 text-[10px] uppercase tracking-widest text-signal">{error}</p>
      ) : !meta ? (
        <p className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">
          Building the briefing…
        </p>
      ) : (
        <>
          {data?.notice ? <p className="mt-3 text-xs text-warn">{data.notice} · This run is degraded.</p> : null}
          <section className="mt-4">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-scan">
              Synopsis
            </h2>
            <div className="mt-2 space-y-2">
              {lines.map((line) => (
                <p key={line} className="text-[11px] leading-relaxed text-foreground">
                  {line}
                </p>
              ))}
            </div>
          </section>

          <section className="mt-5 grid gap-x-8 gap-y-0 sm:grid-cols-2">
            <div>
              <h2 className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-scan">
                Run parameters
              </h2>
              <dl>
                <Row label="Engine" value={`Wave-Synthesis ${meta.model_tier ?? "V1"}`} />
                <Row label="Source" value={data?.source ?? "wave-collapse-local"} />
                <Row label="Ocean state" value={meta.enso_state} />
                <Row
                  label="Confidence"
                  value={`${Math.round(meta.confidence_score * 100)}%${meta.confidence_basis ? ` · ${meta.confidence_basis}` : ""}`}
                />
                <Row
                  label="Measured anchor"
                  value={
                    meta.last_measured
                      ? `${meta.last_measured.iso} · high ${triple(meta.last_measured.high)}`
                      : "unanchored"
                  }
                />
                <Row label="Measured days used" value={String(meta.measurement_days_used ?? 0)} />
              </dl>
            </div>

            <div>
              <h2 className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-scan">
                Peak
              </h2>
              <dl>
                <Row label="Date" value={longDate(meta.peak_date)} />
                <Row label="Intensity" value={triple(meta.peak_intensity)} />
                <Row
                  label="Anomaly"
                  value={
                    typeof meta.peak_anomaly === "number"
                      ? `${meta.peak_anomaly > 0 ? "+" : ""}${meta.peak_anomaly.toFixed(1)}°F vs normal`
                      : "--"
                  }
                />
                <Row
                  label="Window"
                  value={meta.window ? `${meta.window.start} → ${meta.window.end}` : "--"}
                />
                <Row
                  label="Microclimate shift"
                  value={
                    typeof meta.microclimate?.level_shift === "number"
                      ? `${meta.microclimate.level_shift > 0 ? "+" : ""}${meta.microclimate.level_shift.toFixed(1)}°F`
                      : "--"
                  }
                />
                <Row
                  label="Upwind water"
                  value={
                    meta.microclimate?.water_bodies?.length
                      ? `${meta.microclimate.water_bodies[0]?.name} · ${Math.round(meta.microclimate.water_bodies[0]?.distance_mi ?? 0)} mi`
                      : "none in cone"
                  }
                />
              </dl>
            </div>
          </section>

          {mold ? (
            <section className="mt-5">
              <h2 className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-scan">
                Crop pathogen pressure (Botrytis)
              </h2>
              <dl className="sm:grid sm:grid-cols-2 sm:gap-x-8">
                <Row
                  label="Max germination risk"
                  value={`${mold.max_botrytis_spore_risk_pct.toFixed(1)}%`}
                />
                <Row label="Mean VPD" value={`${mold.average_vpd_kpa.toFixed(2)} kPa`} />
                <Row label="Wet hours at peak" value={`${mold.peak_wet_hours.toFixed(1)} h`} />
                <Row label="Status" value={mold.status_code.replace(/_/g, " ")} />
              </dl>
              <p className="mt-2 text-[10px] leading-relaxed text-foreground">
                {mold.action_recommendation}
              </p>
            </section>
          ) : null}

          {meta.analog_years?.length ? (
            <section className="mt-5">
              <h2 className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-scan">
                Analog years
              </h2>
              <p className="text-[10px] text-foreground">
                {meta.analog_years
                  .map((a) => `${a.year} (${Math.round(a.score * 100)}%)`)
                  .join(" · ")}
              </p>
            </section>
          ) : null}

          <section className="mt-5 border-t border-border pt-3">
            <h2 className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-scan">
              Method note
            </h2>
            <p className="text-[9.5px] leading-relaxed text-muted-foreground">
              Local measured observations come first, historical analogs from 1950 onward second,
              the synthesis model third. Fine-grain readings stay on the device; only canonical
              aggregates are published. Coefficients and the synthesis weighting are proprietary
              and are not disclosed in this briefing. The same run is available as JSON at{" "}
              <code>/api/public/forecast?lat={lat}&amp;lon={lon}</code>.
            </p>
          </section>

          <nav className="mt-5 flex flex-wrap gap-2 print:hidden">
            <Link
              to="/forecast"
              className="rounded-full border border-border px-3 py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground"
            >
              Back to forecast
            </Link>
            <a
              href={`/api/public/forecast?lat=${lat}&lon=${lon}`}
              className="rounded-full border border-border px-3 py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground"
            >
              Raw JSON
            </a>
          </nav>
        </>
      )}
    </main>
  );
}
