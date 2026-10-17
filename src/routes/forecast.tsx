import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import AppTopBar from "@/components/AppTopBar";
import { useEffect, useMemo, useState } from "react";
import ForecastChart from "@/components/ForecastChart";
import { fck } from "@/lib/temp";
import LiveConditions from "@/components/LiveConditions";
import { sweepDevice, sweepParams, sweepSupported } from "@/lib/device-sensors";
import { sendFieldReport, signalLabel } from "@/lib/field-array";
import PremiumModal from "@/components/PremiumModal";
import { CropRiskPanel } from "@/components/CropRiskPanel";
import { FrostWatchPanel } from "@/components/FrostWatchPanel";
import { useTier } from "@/lib/saas";
import {
  fetchWaveForecast,
  normalizeSubscriptionTier,
  tierDayLimit,
  timelineLabelToIsoDate,
  trimTimelineByTier,
  type WaveForecastResponse,
  type WaveTimelinePoint,
} from "@/services/forecastApi";
import { lastStationBlend } from "@/services/forecastApi";
import { StudyCheckin } from "@/components/StudyCheckin";

type ForecastSearch = { lat?: number | undefined; lon?: number | undefined };

const DEFAULT_LAT = 44.98;
const DEFAULT_LON = -84.6;
/** Measured history always requested, regardless of what the view shows. */
const MEASURED_HISTORY_DAYS = 92;
const TITLE = "Enphase Operator — Wave Collapse Forecast";
const DESCRIPTION =
  "Enphase Operator finds the finite peak date of a warm window from ENSO, Rossby jet, solar-lunar and almanac signals layered on live observations.";

function parseCoord(value: unknown, min: number, max: number): number | undefined {
  const parsed = Number(typeof value === "string" || typeof value === "number" ? value : NaN);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

export const Route = createFileRoute("/forecast")({
  validateSearch: (s: Record<string, unknown>): ForecastSearch => ({
    lat: parseCoord(s["lat"], -90, 90),
    lon: parseCoord(s["lon"], -180, 180),
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
  component: ForecastRoute,
});

function isoOf(point: WaveTimelinePoint): string {
  return point.iso ?? timelineLabelToIsoDate(point.date);
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "peak" | "anomaly" | "confidence" | "ocean";
}) {
  const toneClass = {
    peak: "border-scan/60 text-scan",
    anomaly: "border-warn/60 text-warn",
    confidence: "border-signal/60 text-signal",
    ocean: "border-warn/40 text-warn",
  }[tone];
  return (
    <div className={`rounded-sm border bg-card/70 p-2 ${toneClass}`}>
      <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-[12px] font-bold uppercase tracking-[0.12em]">{value}</p>
      <p className="mt-0.5 truncate text-[7px] uppercase tracking-widest text-muted-foreground">
        {sub}
      </p>
    </div>
  );
}

function ForecastRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { tier } = useTier();
  const subscriptionTier = normalizeSubscriptionTier(tier);
  const [data, setData] = useState<WaveForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * How much of the timeline is VISIBLE. This is a view control only — it is
   * never sent to the engine, so switching it cannot move the peak, the
   * confidence or any other published number.
   */
  const [viewDays, setViewDays] = useState(45);
  /**
   * Where the forecast is actually being run. A coordinate in the URL wins
   * (map pick, watch hand-off); otherwise the device's own position is used,
   * and the home coordinate is only the last resort.
   */
  const [located, setLocated] = useState<{ lat: number; lon: number; source: "gps" } | null>(null);
  const [locating, setLocating] = useState(false);
  /** GPS attempt finished (or skipped) — prevents home→GPS double fetch. */
  const [geoSettled, setGeoSettled] = useState(false);
  /** Sign-in restored — prevents a first anonymous (7-day) fetch. */
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    let live = true;
    void import("@/integrations/supabase/client")
      .then(({ supabase }) => supabase.auth.getSession())
      .catch(() => null)
      .finally(() => {
        if (live) setAuthReady(true);
      });
    return () => {
      live = false;
    };
  }, []);
  const lat = search.lat ?? located?.lat ?? DEFAULT_LAT;
  const lon = search.lon ?? located?.lon ?? DEFAULT_LON;
  const locationSource = search.lat !== undefined && search.lon !== undefined
    ? "picked on the map"
    : located
      ? "this device"
      : "home coordinate";
  // On-device sweep. Absent on most hardware; when present it nudges the next
  // few days only, and the dashboard says so out loud.
  const [sweep, setSweep] = useState<Record<string, string>>({});
  const [sweepState, setSweepState] = useState<"off" | "reading" | "on" | "none">("off");

  // No coordinate in the URL: ask the device once, so the dashboard reports
  // where the operator actually is instead of silently defaulting home.
  useEffect(() => {
    if (search.lat !== undefined && search.lon !== undefined) {
      setGeoSettled(true);
      return;
    }
    if (located || typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoSettled(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocated({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: "gps" });
        setLocating(false);
        setGeoSettled(true);
      },
      () => {
        setLocating(false);
        setGeoSettled(true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [search.lat, search.lon, located]);

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNotice("this device cannot report a position");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocated({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: "gps" });
        setLocating(false);
        void navigate({ to: "/forecast", search: { lat: pos.coords.latitude, lon: pos.coords.longitude } });
      },
      () => {
        setLocating(false);
        setNotice("position unavailable — check location permission");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    let cancelled = false;
    if (!sweepSupported()) {
      setSweepState("none");
      return () => {
        cancelled = true;
      };
    }
    setSweepState("reading");
    void sweepDevice().then((reading) => {
      if (cancelled) return;
      const params = sweepParams(reading);
      // Only refetch when the reading actually changed.
      setSweep((prev) => (JSON.stringify(prev) === JSON.stringify(params) ? prev : params));
      setSweepState(Object.keys(params).length ? "on" : "none");
      // Every install is a station: hand the same reading to the shared array
      // so the next forecast for this area is measured, not just modelled.
      void sendFieldReport({ lat, lon, sweep: reading });
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  /**
   * One fetch per location and sensor state. The amount of history requested is
   * fixed so that the model inputs are identical no matter which view range the
   * operator is looking at.
   */
  useEffect(() => {
    if (!authReady || !geoSettled) return;
    const abort = new AbortController();
    setLoading(true);
    setError(null);
    // The previous forecast stays painted while this refresh runs.
    void fetchWaveForecast({ lat, lon, days: 365, past: MEASURED_HISTORY_DAYS, sensor: sweep, signal: abort.signal })
      .then((res) => {
        if (!abort.signal.aborted) setData(res);
      })
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        if (err instanceof Error && err.name === "AbortError") return;
        if (/aborted/i.test(err instanceof Error ? err.message : "")) return;
        setError(err instanceof Error ? err.message : "forecast unavailable");
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [lat, lon, sweep, authReady, geoSettled]);

  const meta = data?.metadata;
  const targetWindow = meta?.window;

  // Measured history is always shown in full; the paid gate applies to how far
  // forward the synthesis may be read.
  const timeline = useMemo(() => {
    // Keep date order intact: trimming only drops days past today + plan limit.
    return trimTimelineByTier(data?.timeline ?? [], subscriptionTier);
  }, [data?.timeline, subscriptionTier]);

  const windowDays = useMemo(() => {
    if (!targetWindow) return [];
    return timeline.filter(
      (p) => isoOf(p) >= targetWindow.start && isoOf(p) <= targetWindow.end,
    );
  }, [timeline, targetWindow]);

  const weights = meta?.signal_weights ?? [];

  const canEnableAlerts = typeof Notification !== "undefined" && "serviceWorker" in navigator;
  const pushAlert = async () => {
    if (!meta || !canEnableAlerts) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNotice("notifications blocked");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("Wave forecast peak", {
      body: `${meta.peak_date} projected at ${meta.peak_intensity}°F`,
      tag: `forecast-${meta.peak_date}`,
      data: { lat, lon, peakDate: meta.peak_date },
    });
    setNotice("peak alert armed");
  };

  const streamLive = !loading && !error && !data?.notice;

  return (
    <main className="no-scrollbar min-h-app overflow-y-auto scan-grid face-pad pb-6 pt-2">
      <AppTopBar title="Enphase Operator" subtitle="wave collapse · v4.2" backTo="/wx" storageKey="forecast">
        <span
          className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[7px] uppercase tracking-widest ${
            streamLive ? "animate-pulse border-signal/60 text-signal" : "border-warn/60 text-warn"
          }`}
        >
          {streamLive ? "stream active" : "degraded"}
        </span>
      </AppTopBar>

      <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
        <Link
          to="/doppler"
          search={{ lat, lon }}
          className="rounded-sm border border-alert/60 px-2 py-1 text-center text-[8px] uppercase tracking-widest text-alert"
        >
          doppler
        </Link>
        <Link
          to="/map"
          search={{ lat, lon }}
          className="rounded-sm border border-scan/60 px-2 py-1 text-center text-[8px] uppercase tracking-widest text-scan"
        >
          location
        </Link>
        <Link
          to="/weather"
          className="rounded-sm border border-border px-2 py-1 text-center text-[8px] uppercase tracking-widest text-muted-foreground"
        >
          get the app
        </Link>
        {subscriptionTier === "operator" ? (
          <span className="rounded-sm border border-warn/60 px-2 py-1 text-center text-[8px] uppercase tracking-widest text-warn">
            operator · full
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setPremiumOpen(true)}
            className="rounded-sm border border-signal/60 px-2 py-1 text-[8px] uppercase tracking-widest text-signal"
          >
            upgrade
          </button>
        )}
      </div>

      <div className="mt-2">
        <LiveConditions lat={lat} lon={lon} />
      </div>


      {meta && (loading || error) ? (
        <p className="mt-3 text-[8px] uppercase tracking-widest text-muted-foreground">
          {loading ? "refreshing…" : "showing last reading"}
        </p>
      ) : null}
      {loading && !meta ? (
        <section className="mt-2 grid grid-cols-2 gap-1" aria-label="Forecast loading">
          {["finite peak target", "held window", "seasonal normal", "confidence"].map((label) => (
            <div key={label} className="rounded-sm border border-border bg-card/60 p-3">
              <p className="text-[8px] uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className="mt-2 h-5 w-2/3 animate-pulse rounded-sm bg-muted" />
            </div>
          ))}
          <p className="col-span-2 mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">
            crunching wave synthesis…
          </p>
        </section>
      ) : error && !meta ? (
        <p className="mt-3 rounded-sm border border-alert/50 bg-card/60 px-2 py-2 text-[8px] uppercase tracking-widest text-alert">
          {error}
        </p>
      ) : !meta ? (
        <p className="mt-3 text-[9px] uppercase tracking-widest text-muted-foreground">
          no forecast data
        </p>
      ) : (
        <>
          <StudyCheckin />
          <section className="mt-2 grid grid-cols-2 gap-1">
            <Kpi
              label="finite peak target"
              value={meta.peak_date}
              sub="collapse point dW/dt = 0"
              tone="peak"
            />
            <Kpi
              label="peak anomaly"
              value={fck(meta.peak_intensity)}
              sub={
                typeof meta.peak_anomaly === "number"
                  ? `${meta.peak_anomaly > 0 ? "+" : ""}${meta.peak_anomaly.toFixed(1)}° vs normal`
                  : "vs seasonal normal"
              }
              tone="anomaly"
            />
            <Kpi
              label="model confidence"
              value={`${Math.round(meta.confidence_score * 100)}%`}
              sub={meta.anchored ? `${meta.observations_used ?? 0} measured days` : "unanchored"}
              tone="confidence"
            />
            <Kpi
              label="macro ocean state"
              value={meta.enso_state}
              sub="ENSO anomaly vector"
              tone="ocean"
            />
          </section>

          <div className="mt-2">
            <Link
              to="/briefing"
              search={{ lat, lon }}
              className="inline-block rounded-full border border-scan/60 bg-scan/10 px-3 py-1.5 text-[9px] uppercase tracking-widest text-scan"
            >
              Meteorologist briefing · printable
            </Link>
          </div>

          {meta.nightly_lows?.nights.length ? (
            <FrostWatchPanel data={meta.nightly_lows} />
          ) : null}

          {meta.microclimate_mold_index ? (
            <CropRiskPanel mold={meta.microclimate_mold_index} />
          ) : null}

          {meta.last_measured ? (
            <section className="mt-2 rounded-sm border border-scan/50 bg-card/60 p-2">
              <p className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                measured anchor
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-widest text-scan">
                {meta.last_measured.iso} · high{" "}
                {meta.last_measured.high === null ? "--" : `${Math.round(meta.last_measured.high)}°`}{" "}
                · daily mean{" "}
                {meta.last_measured.mean === null ? "--" : `${Math.round(meta.last_measured.mean)}°`}
              </p>
              <p className="mt-1 text-[7.5px] uppercase tracking-widest text-muted-foreground">
                {typeof meta.measurement_correction === "number" && meta.measurement_correction !== 0
                  ? `projection shifted ${meta.measurement_correction > 0 ? "+" : ""}${meta.measurement_correction.toFixed(1)}° to match the last ${meta.measurement_days_used ?? 0} measured days`
                  : "projection already matching the measured days"}
              </p>
              <p className="mt-1 text-[7.5px] uppercase tracking-widest text-muted-foreground">
                device sweep:{" "}
                {sweepState === "reading"
                  ? "reading sensors…"
                  : sweepState === "on"
                    ? `barometer ${meta.sensor_inputs?.pressure?.toFixed(0) ?? "--"} hPa · 3h ${
                        typeof meta.sensor_inputs?.trend === "number"
                          ? `${meta.sensor_inputs.trend > 0 ? "+" : ""}${meta.sensor_inputs.trend.toFixed(1)}`
                          : "--"
                      } · near-term ${
                        typeof meta.sensor_correction === "number" && meta.sensor_correction !== 0
                          ? `${meta.sensor_correction > 0 ? "+" : ""}${meta.sensor_correction.toFixed(1)}°`
                          : "no change"
                      }`
                    : "no sensors on this device · public observations only"}
              </p>
              <p className="mt-1 text-[7.5px] uppercase tracking-widest text-muted-foreground">
                field array:{" "}
                {meta.mesh_inputs && meta.mesh_inputs.nodes > 0
                  ? `${meta.mesh_inputs.nodes} station${meta.mesh_inputs.nodes === 1 ? "" : "s"} nearby · signal ${
                      typeof meta.mesh_inputs.signal_score === "number"
                        ? `${Math.round(meta.mesh_inputs.signal_score)} ${signalLabel(Math.round(meta.mesh_inputs.signal_score))}`
                        : "--"
                    } · near-term ${
                      typeof meta.mesh_correction === "number" && meta.mesh_correction !== 0
                        ? `${meta.mesh_correction > 0 ? "+" : ""}${meta.mesh_correction.toFixed(1)}°`
                        : "no change"
                    }`
                  : "no stations reporting nearby yet"}{" "}
                <Link to="/array" className="text-signal underline">
                  open array
                </Link>
              </p>
              {meta.ternary ? (
                <p className="mt-1 text-[7.5px] uppercase tracking-widest text-muted-foreground">
                  369 gate:{" "}
                  <span className={meta.ternary.state === 9 ? "text-warn" : "text-signal"}>
                    |{meta.ternary.state}&gt; {meta.ternary.label}
                  </span>{" "}
                  · {meta.ternary.voting}/{meta.ternary.witnesses} witnesses ·{" "}
                  {Math.round(meta.ternary.agreement * 100)}% agreement · gate open{" "}
                  {Math.round(meta.ternary.gain * 100)}%
                </p>
              ) : null}
            </section>

          ) : null}

          {data?.notice ? (
            <p className="mt-2 rounded-sm border border-warn/60 bg-card/60 px-2 py-2 text-[8px] uppercase tracking-widest text-warn">
              {data.notice}
            </p>
          ) : null}

          <section className="mt-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                real-time wave synthesis
              </p>
              <div className="flex gap-1">
                {[7, 45, 92, 365].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setViewDays(days)}
                    aria-pressed={viewDays === days}
                    className={`rounded-sm border px-1.5 py-0.5 text-[7px] uppercase tracking-widest ${
                      viewDays === days
                        ? "border-signal/70 text-signal"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {days}d view
                  </button>
                ))}
              </div>
            </div>
            <ForecastChart
              timeline={timeline}
              peakIso={meta.peak_date}
              windowStart={targetWindow?.start}
              windowEnd={targetWindow?.end}
              height={216}
              initialSpan={viewDays}
              lows={meta.nightly_lows?.nights.map((n) => ({ iso: n.iso, low_f: n.low_f })) ?? []}
            />
            {Number.isFinite(tierDayLimit(subscriptionTier)) && viewDays > tierDayLimit(subscriptionTier) ? (
              <p className="mt-1 text-[8px] text-warn">
                This account includes {tierDayLimit(subscriptionTier)} days ahead. A longer view needs a longer-range plan.
              </p>
            ) : null}
            <p className="mt-1 text-[7px] uppercase tracking-widest text-muted-foreground">
              view range only changes what you see · the forecast numbers stay the same
            </p>
          </section>

          <section className="mt-2 rounded-sm border border-border bg-card/60 p-2">
            <p className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
              held window
            </p>
            <p className="mt-1 text-[8px] uppercase tracking-widest text-signal">
              {targetWindow
                ? `${targetWindow.start} → ${targetWindow.end}`
                : "seasonal target window"}
            </p>
            <div className="mt-1 grid grid-cols-2 gap-1 text-[7.5px] uppercase tracking-widest text-muted-foreground">
              <span>days in window: {windowDays.length}</span>
              <span>above normal: {meta.window_days_above_normal ?? 0}</span>
              <span>
                mean hold:{" "}
                {typeof meta.window_hold_anomaly === "number"
                  ? `${meta.window_hold_anomaly > 0 ? "+" : ""}${meta.window_hold_anomaly.toFixed(1)}°`
                  : "—"}
              </span>
              <span>
                trough stretch: {typeof meta.stretch_ratio === "number" ? `${meta.stretch_ratio}×` : "—"}
              </span>
            </div>
            <p className="mt-1 text-[7px] leading-relaxed text-muted-foreground">
              Ridging drives tight hot-cold chop; as the pattern matures the spacing between troughs
              and peaks stretches and the slope flattens, which is what holds the window above
              normal instead of spiking once.
            </p>
          </section>

          {meta.model_tier === "V2" ? (
            <section className="mt-2 rounded-sm border border-scan/40 bg-card/60 p-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[8px] uppercase tracking-[0.2em] text-scan">
                  analog shift · reset node collapse
                </p>
                <span className="rounded-sm border border-scan/60 px-1.5 py-0.5 text-[7px] uppercase tracking-widest text-scan">
                  V2 engine
                </span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[7.5px] uppercase tracking-widest text-muted-foreground">
                <span>
                  reset node:{" "}
                  {meta.reset_node
                    ? `${meta.reset_node.iso} · ${meta.reset_node.temp.toFixed(0)}°`
                    : "none in horizon"}
                </span>
                <span>
                  rebound to peak:{" "}
                  {typeof meta.rebound_days === "number" ? `${meta.rebound_days} d` : "—"}
                </span>
                <span className="col-span-2">
                  false peak suppressed:{" "}
                  {meta.false_peak
                    ? `${meta.false_peak.iso} · ${meta.false_peak.temp.toFixed(0)}° → ${meta.false_peak.suppressed_to.toFixed(0)}°`
                    : "none"}
                </span>
              </div>
              <p className="mt-1 text-[7px] leading-relaxed text-muted-foreground">
                A hard localised frost resets regional soil thermal mass and ends the pre-reset wave
                train. Any maximum before that node is a false peak: it is recorded and suppressed,
                never published. The reported collapse is the stationary point of the rebound wave
                that follows the reset.
              </p>
            </section>
          ) : null}

          <section className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="rounded-sm border border-border bg-card/60 p-2">
              <p className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                signal weight decomposition
              </p>
              <div className="mt-1.5 grid gap-1.5">
                {weights.map((w) => (
                  <div key={w.key}>
                    <div className="flex items-center justify-between text-[7px] uppercase tracking-widest text-muted-foreground">
                      <span>{w.label}</span>
                      <span>{Math.round(w.weight * 100)}%</span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full rounded-xs bg-muted/30">
                      <div
                        className="h-full rounded-xs bg-signal"
                        style={{ width: `${Math.round(w.weight * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[7px] leading-relaxed text-muted-foreground">
                Published weights only. Coefficients, phases and the stretching function stay
                server-side.
              </p>
            </div>

            <div className="rounded-sm border border-border bg-card/60 p-2 font-mono">
              <p className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                engine telemetry
              </p>
              <div className="mt-1.5 grid gap-0.5 text-[7px] text-muted-foreground">
                <span>engine: {data?.source ?? "unknown"}</span>
                <span>
                  vector: {lat.toFixed(2)}° / {lon.toFixed(2)}° ·{" "}
                  {locating ? "finding this device…" : locationSource}
                </span>
                <span>observations: {meta.observations_used ?? 0} measured days</span>
                <span>
                  stations:{" "}
                  {lastStationBlend
                    ? `${lastStationBlend.count} · ${lastStationBlend.avgMiles.toFixed(1)} mi avg · ${lastStationBlend.ageMin} min old`
                    : "none in range"}
                </span>
                <span>
                  coverage:{" "}
                  {typeof meta.observation_coverage === "number"
                    ? `${Math.round(meta.observation_coverage * 100)}%`
                    : "—"}
                </span>
                <span>turning points: {data?.turning_points?.length ?? 0}</span>
                <span>
                  access: {subscriptionTier} ·{" "}
                  {Number.isFinite(tierDayLimit(subscriptionTier))
                    ? `${tierDayLimit(subscriptionTier)} forward days`
                    : "full horizon"}
                </span>
                {meta.analog_years?.length ? (
                  <span>
                    analog years:{" "}
                    {meta.analog_years.map((a) => a.year).join(" · ")} ·{" "}
                    {Math.round((meta.analog_agreement ?? 0) * 100)}% agreement
                  </span>
                ) : null}
                <span>{meta.confidence_basis ?? ""}</span>
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={() => void pushAlert()}
            disabled={!canEnableAlerts}
            className="mt-2 w-full rounded-sm border border-scan/60 px-2 py-2 text-[8px] uppercase tracking-widest text-scan disabled:border-border disabled:text-muted-foreground"
          >
            alert me on the peak date
          </button>
          {notice ? (
            <p className="mt-1 text-[8px] uppercase tracking-widest text-scan">{notice}</p>
          ) : null}
        </>
      )}

      <PremiumModal
        open={premiumOpen}
        currentTier={subscriptionTier}
        onClose={() => setPremiumOpen(false)}
      />
    </main>
  );
}
