import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBridge } from "@/lib/bridge-hooks";
import {
  BIO_COMMANDS,
  BIO_LABEL,
  BIO_UNIT,
  latestByKind,
  parseBatteryTemp,
  parseLogcatBio,
  parseSensorService,
  readingsFromSensors,
  type BioKind,
  type BioReading,
  type SensorEntry,
} from "@/lib/biometrics";

export const Route = createFileRoute("/bio")({
  head: () => ({
    meta: [
      { title: "Apex Biometrics — Watch Sensor Harvest" },
      {
        name: "description",
        content:
          "Harvest background heart rate, blood pressure, SpO2 and temperature measurements from the LOKMAT watch by scraping sensorservice and logcat over the ADB bridge.",
      },
      { property: "og:title", content: "Apex Biometrics" },
      {
        property: "og:description",
        content:
          "Background heart rate, blood pressure, SpO2 and temperature from real watch sensors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Bio,
});

const ORDER: BioKind[] = ["hr", "bp", "spo2", "temp", "hrv", "steps", "stress", "offbody"];

function ago(at: number | null): string {
  if (!at) return "never";
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function fmt(r: BioReading): string {
  if (r.kind === "bp" && r.value2 !== undefined)
    return `${Math.round(r.value)}/${Math.round(r.value2)}`;
  return r.value >= 100 ? String(Math.round(r.value)) : r.value.toFixed(1).replace(/\.0$/, "");
}

function Bio() {
  const { run, state, target, latency } = useBridge();
  const [readings, setReadings] = useState<BioReading[]>([]);
  const [sensors, setSensors] = useState<SensorEntry[]>([]);
  const [pkgs, setPkgs] = useState<string[]>([]);
  const [thermal, setThermal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [watching, setWatching] = useState(false);
  const [open, setOpen] = useState<BioKind | null>(null);
  const [, tick] = useState(0);
  const lock = useRef(false);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const sweep = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setErr(null);
    const now = Date.now();
    const found: BioReading[] = [];

    const safe = async (cmd: string) => {
      try {
        return await run(cmd, 20000);
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : `failed: ${cmd}`);
      }
    };

    try {
      const dump = await safe(BIO_COMMANDS.sensorList);
      const list = parseSensorService(dump);
      setSensors(list);
      found.push(...readingsFromSensors(list, now));

      const log = await safe(BIO_COMMANDS.logcatBio);
      found.push(...parseLogcatBio(log, now));

      const batt = await safe(BIO_COMMANDS.batteryTemp);
      setThermal(parseBatteryTemp(batt));

      try {
        const p = await run(BIO_COMMANDS.sensorPackages, 15000);
        setPkgs(
          p
            .split("\n")
            .map((l) => l.replace("package:", "").trim())
            .filter(Boolean)
            .slice(0, 12),
        );
      } catch {
        setPkgs([]);
      }

      setReadings((prev) => [...found, ...prev].slice(0, 400));
      setAt(Date.now());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "harvest failed");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }, [run]);

  useEffect(() => {
    if (state === "online") void sweep();
  }, [state, sweep]);

  /* background watch: re-scrape logcat on an interval so passive
     measurements taken by the vendor health service land here */
  useEffect(() => {
    if (!watching || state !== "online") return;
    const t = setInterval(() => void sweep(), 15000);
    return () => clearInterval(t);
  }, [watching, state, sweep]);

  const latest = latestByKind(readings);
  const channels = sensors.filter((s) => s.bio);

  return (
    <main className="flex h-app w-full flex-col overflow-hidden bg-background p-[var(--face-inset)] text-foreground">
      <header className="mb-1 flex shrink-0 items-center gap-1.5">
        <Link
          to="/app"
          aria-label="Back"
          className="rounded-sm border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground active:bg-accent"
        >
          ‹
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-widest text-alert">
          Biometrics
        </h1>
        <button
          type="button"
          onClick={() => setWatching((w) => !w)}
          className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[8px] uppercase tracking-widest active:bg-accent ${
            watching ? "border-signal/60 text-signal" : "border-border text-muted-foreground"
          }`}
        >
          {watching ? "watch" : "idle"}
        </button>
        <button
          type="button"
          onClick={() => void sweep()}
          disabled={busy || state !== "online"}
          className="shrink-0 rounded-sm border border-alert/50 px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-alert active:bg-accent disabled:opacity-40"
        >
          {busy ? "…" : "scan"}
        </button>
      </header>

      <div className="mb-1 shrink-0 rounded-sm border border-border bg-card/70 px-2 py-1">
        <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
          link {state}
          {latency ? ` · ${latency}ms` : ""} · {target ?? "no endpoint"}
        </p>
        <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
          harvest {ago(at)} · {channels.length} bio sensor(s) · {readings.length} sample(s)
        </p>
      </div>

      {state !== "online" ? (
        <p className="mb-1 shrink-0 text-[8px] uppercase tracking-wider text-warn">
          bridge offline — connect the adb agent to read sensors
        </p>
      ) : null}
      {err ? (
        <p className="mb-1 shrink-0 truncate text-[8px] uppercase tracking-wider text-alert">
          {err}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="mb-1.5 grid grid-cols-2 gap-1">
          {ORDER.map((k) => {
            const r = latest[k];
            const has = Boolean(r);
            return (
              <button
                key={k}
                type="button"
                onClick={() => setOpen(open === k ? null : k)}
                className={`rounded-sm border px-1.5 py-1 text-left active:bg-accent ${
                  has ? "border-signal/50 bg-card/70" : "border-border bg-card/40"
                }`}
              >
                <span className="block truncate text-[7px] uppercase tracking-widest text-muted-foreground">
                  {BIO_LABEL[k]}
                </span>
                <span
                  className={`block truncate text-[15px] font-bold leading-tight ${
                    has ? "text-signal" : "text-muted-foreground"
                  }`}
                >
                  {r ? fmt(r) : "—"}
                  <span className="ml-0.5 text-[7px] font-normal text-muted-foreground">
                    {r ? BIO_UNIT[k] : ""}
                  </span>
                </span>
                <span className="block truncate text-[7px] uppercase tracking-wider text-muted-foreground">
                  {r ? `${r.source} · ${ago(r.at)}` : "no channel"}
                </span>
              </button>
            );
          })}
        </section>

        {open && latest[open] ? (
          <pre className="mb-1.5 max-h-24 overflow-auto rounded-sm border border-border bg-card/70 p-1 text-[7px] leading-tight text-muted-foreground">
            {latest[open]?.raw}
          </pre>
        ) : null}

        <section className="mb-1.5">
          <h2 className="mb-0.5 text-[8px] uppercase tracking-widest text-scan">
            sensor inventory
          </h2>
          {channels.length === 0 ? (
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
              {sensors.length
                ? `${sensors.length} sensors, none biometric`
                : "no sensorservice dump yet"}
            </p>
          ) : (
            channels.map((s) => (
              <div
                key={`${s.handle}-${s.name}`}
                className="mb-0.5 rounded-sm border border-signal/40 bg-card/70 px-1.5 py-1"
              >
                <p className="truncate text-[8px] font-bold uppercase tracking-wider text-signal">
                  {s.name}
                </p>
                <p className="truncate text-[7px] uppercase tracking-wider text-muted-foreground">
                  {s.bio} · {s.stringType || "vendor type"} · {s.vendor || "unknown vendor"}
                  {s.last ? ` · last ${s.last.join(", ")}` : ""}
                </p>
              </div>
            ))
          )}
        </section>

        <section className="mb-1.5">
          <h2 className="mb-0.5 text-[8px] uppercase tracking-widest text-scan">device thermal</h2>
          <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
            {thermal !== null ? `battery ${thermal.toFixed(1)} °C (dumpsys battery)` : "unreported"}
          </p>
        </section>

        <section className="mb-1.5">
          <h2 className="mb-0.5 text-[8px] uppercase tracking-widest text-scan">health packages</h2>
          {pkgs.length ? (
            pkgs.map((p) => (
              <p key={p} className="truncate text-[7px] tracking-wider text-muted-foreground">
                {p}
              </p>
            ))
          ) : (
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
              none matched
            </p>
          )}
        </section>

        <section className="mb-2">
          <h2 className="mb-0.5 text-[8px] uppercase tracking-widest text-scan">sample log</h2>
          {readings.slice(0, 30).map((r, i) => (
            <p
              key={`${r.at}-${i}-${r.kind}`}
              className="truncate text-[7px] tracking-wider text-muted-foreground"
            >
              <span className="text-signal">{BIO_LABEL[r.kind]}</span> {fmt(r)} {BIO_UNIT[r.kind]} ·{" "}
              {r.source}
            </p>
          ))}
          {readings.length === 0 ? (
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
              nothing harvested yet — run a scan while the watch takes a background measurement
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
