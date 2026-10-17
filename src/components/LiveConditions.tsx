import { useEffect, useRef, useState } from "react";
import {
  compass,
  dayLabel,
  fetchConditions,
  type ConditionsResponse,
} from "@/services/conditionsApi";

const REFRESH_MS = 60_000;
const f = (v: number | null, unit = "") => (v === null ? "--" : `${Math.round(v)}${unit}`);

/**
 * The "now" layer: real observations, refreshed every minute while the device
 * is online and the page is visible. Offline it holds the last reading and
 * says so rather than blanking out.
 */
export default function LiveConditions({ lat, lon }: { lat: number; lon: number }) {
  const [data, setData] = useState<ConditionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [at, setAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    const abort = new AbortController();

    const load = () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void fetchConditions({ lat, lon, signal: abort.signal })
        .then((res) => {
          if (!alive) return;
          setData(res);
          setError(null);
          setAt(Date.now());
        })
        .catch((err: unknown) => {
          if (!alive || abort.signal.aborted) return;
          setError(err instanceof Error ? err.message : "conditions unavailable");
        });
    };

    load();
    timer.current = setInterval(load, REFRESH_MS);

    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    document.addEventListener("visibilitychange", load);

    return () => {
      alive = false;
      abort.abort();
      if (timer.current) clearInterval(timer.current);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      document.removeEventListener("visibilitychange", load);
    };
  }, [lat, lon]);

  const cur = data?.current;

  return (
    <section className="rounded-sm border border-border bg-card/60 p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <p className="truncate text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
          live conditions · {lat.toFixed(2)}, {lon.toFixed(2)}
        </p>
        <span
          className={`shrink-0 text-[7px] uppercase tracking-widest ${
            online && !error ? "text-signal" : "text-warn"
          }`}
        >
          {!online ? "offline · last reading" : error ? "retrying" : "live"}
        </span>
      </div>

      {cur ? (
        <>
          <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3">
            <p className="text-3xl font-bold leading-none text-signal">{f(cur.temp, "°")}</p>
            <div className="min-w-0">
              <p className="truncate text-[10px] uppercase tracking-widest text-foreground">
                {cur.condition}
              </p>
              <p className="truncate text-[8px] uppercase tracking-widest text-muted-foreground">
                feels {f(cur.feels_like, "°")} · {compass(cur.wind_dir)} {f(cur.wind)} mph
                {cur.gust !== null ? ` · gust ${f(cur.gust)}` : ""}
              </p>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1">
            {[
              ["humidity", f(cur.humidity, "%")],
              ["dew pt", f(cur.dew_point, "°")],
              ["cloud", f(cur.cloud_cover, "%")],
              ["pressure", f(cur.pressure)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-sm border border-border bg-background/60 p-1.5">
                <p className="text-[7px] uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="text-[10px] font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          {data && data.hourly.length > 0 ? (
            <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto">
              {data.hourly.slice(0, 24).map((h) => (
                <div
                  key={h.time}
                  className="shrink-0 rounded-sm border border-border bg-background/60 px-1.5 py-1 text-center"
                >
                  <p className="text-[7px] uppercase tracking-widest text-muted-foreground">
                    {h.time.slice(11, 16)}
                  </p>
                  <p className="text-[10px] font-bold text-foreground">{f(h.temp, "°")}</p>
                  <p className="text-[7px] text-scan">{f(h.pop, "%")}</p>
                </div>
              ))}
            </div>
          ) : null}

          {data && data.daily.length > 0 ? (
            <ul className="mt-2 grid gap-1">
              {data.daily.map((d) => (
                <li
                  key={d.date}
                  className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-border bg-background/60 px-2 py-1"
                >
                  <span className="text-[8px] uppercase tracking-widest text-muted-foreground">
                    {dayLabel(d.date)}
                  </span>
                  <span className="truncate text-[8px] uppercase tracking-widest text-foreground">
                    {d.condition}
                    {d.pop !== null ? ` · ${f(d.pop, "%")}` : ""}
                  </span>
                  <span className="text-[9px] font-bold text-signal">
                    {f(d.high, "°")}
                    <span className="text-muted-foreground"> / {f(d.low, "°")}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-2 text-[7px] uppercase tracking-widest text-muted-foreground">
            {at ? `updated ${new Date(at).toLocaleTimeString()}` : ""} · refreshes every minute
          </p>
        </>
      ) : (
        <p className="mt-2 text-[9px] uppercase tracking-widest text-muted-foreground">
          {error ?? "reading conditions…"}
        </p>
      )}
    </section>
  );
}
