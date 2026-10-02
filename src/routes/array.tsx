import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  buildFieldReport,
  contributionEnabled,
  fetchArrayCells,
  sendFieldReport,
  setContribution,
  signalLabel,
  type ArrayCell,
  type FieldReport,
} from "@/lib/field-array";

/**
 * Field array console.
 *
 * Every install is a station. This page shows what the array is measuring —
 * air and radio together — and lets this device join or leave it.
 */

export const Route = createFileRoute("/array")({
  component: ArrayPage,
  head: () => ({
    meta: [
      { title: "Field Sensor Array · Apex Air Solutions" },
      {
        name: "description",
        content:
          "Every installed copy of the app is a weather and signal station. See what the live array is measuring and add your own readings.",
      },
      { property: "og:title", content: "Field Sensor Array · Apex Air Solutions" },
      {
        property: "og:description",
        content:
          "A live array of air pressure, temperature and radio quality readings contributed by every running install.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function fmt(value: number | null, digits = 1, suffix = ""): string {
  return typeof value === "number" ? `${value.toFixed(digits)}${suffix}` : "--";
}

function ago(iso: string | null): string {
  if (!iso) return "--";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function ArrayPage() {
  const [cells, setCells] = useState<ArrayCell[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [optIn, setOptIn] = useState(false);
  const [mine, setMine] = useState<FieldReport | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setOptIn(contributionEnabled());
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setCells(await fetchArrayCells(180, signal));
      setError(null);
    } catch {
      setError("array unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal);
    const timer = window.setInterval(() => void load(), 120_000);
    return () => {
      abort.abort();
      window.clearInterval(timer);
    };
  }, [load]);

  const contribute = async () => {
    setSending(true);
    const report = await sendFieldReport();
    setMine(report ?? (await buildFieldReport()));
    setSending(false);
    void load();
  };

  const totalNodes = cells.reduce((sum, c) => sum + c.nodes, 0);
  const meanSignal = (() => {
    const scored = cells.filter((c) => typeof c.signal_score === "number");
    if (!scored.length) return null;
    return scored.reduce((s, c) => s + (c.signal_score ?? 0), 0) / scored.length;
  })();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <Link to="/forecast" className="text-[10px] uppercase tracking-widest text-muted-foreground">
          ‹ Forecast
        </Link>
        <h1 className="text-[11px] font-bold uppercase tracking-[0.25em] text-signal">
          Field Sensor Array
        </h1>
        <Link to="/" className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Home
        </Link>
      </header>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Every running copy of the app is a station. It reports the air it can measure and the radio
        it can see against a rounded map square — never an address, never a device name. Storms show
        up twice: in the pressure, and in the signal quality dropping across a square.
      </p>

      <section className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Stations, 3h" value={String(totalNodes)} />
        <Stat label="Live squares" value={String(cells.length)} />
        <Stat
          label="Mean signal"
          value={meanSignal === null ? "--" : `${Math.round(meanSignal)} · ${signalLabel(Math.round(meanSignal))}`}
        />
      </section>

      <section className="mt-4 rounded-sm border border-border bg-card/60 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-signal">This device</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {optIn
                ? "Contributing coarse readings to the array."
                : "Not contributing. You still see everything."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !optIn;
              setOptIn(next);
              setContribution(next);
            }}
            className="rounded-sm border border-signal/60 px-3 py-1.5 text-[9px] uppercase tracking-widest text-signal"
          >
            {optIn ? "Stop sharing" : "Join array"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => void contribute()}
          disabled={!optIn || sending}
          className="mt-3 w-full rounded-sm border border-border px-3 py-2 text-[9px] uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          {sending ? "reading sensors…" : "send a reading now"}
        </button>
        {mine ? (
          <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {mine.lat.toFixed(2)}, {mine.lon.toFixed(2)} · {mine.device_class} ·{" "}
            {mine.pressure === null ? "no barometer" : `${fmt(mine.pressure, 0)} hPa`} · signal{" "}
            {mine.signal_score ?? "--"} ({signalLabel(mine.signal_score)}) ·{" "}
            {mine.link_type ?? "unknown link"}
          </p>
        ) : null}
      </section>

      <section className="mt-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Live squares · last three hours
        </p>
        {loading ? (
          <p className="mt-3 text-xs text-muted-foreground">reading the array…</p>
        ) : error ? (
          <p className="mt-3 text-xs text-destructive">
            The array is not answering right now. Your forecast still runs on public observations.
          </p>
        ) : cells.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            No stations reporting yet. Press “send a reading now” to put the first one on the board.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-sm border border-border">
            {cells.map((cell) => (
              <li key={cell.cell} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-foreground">{cell.cell}</p>
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                    {cell.nodes} station{cell.nodes === 1 ? "" : "s"} · {ago(cell.newest)} ·{" "}
                    {cell.pressure === null ? "no barometer" : `${fmt(cell.pressure, 0)} hPa`}
                    {typeof cell.pressure_trend === "number"
                      ? ` · 3h ${cell.pressure_trend > 0 ? "+" : ""}${cell.pressure_trend.toFixed(1)}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-signal">{cell.signal_score ?? "--"}</p>
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                    {signalLabel(cell.signal_score)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-4 text-[9px] uppercase tracking-widest text-muted-foreground">
        Readings are rounded on the device before they are sent. No account, device or network
        identifier is stored, and only averages are ever read back out.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-card/60 px-2 py-2">
      <p className="text-[8px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm text-signal">{value}</p>
    </div>
  );
}
