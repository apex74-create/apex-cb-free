import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  PERMISSIONS,
  readAll,
  requestHid,
  listHid,
  watchCompanion,
  sendReport,
  closeCompanion,
  trilaterate,
  rssiToMetres,
  validateGeometry,
  validateSelfPosition,
  type Anchor,
  type Companion,
  type Fix,
  type PermState,
  type PointMan,
  type GeometricValidation,
} from "@/lib/webperms";
import { callTier, TierLocked, useTier } from "@/lib/saas";
import TrilaterationHUD from "@/components/TrilaterationHUD";
import { solveConfidence, type HudAnchor } from "@/lib/trilateration-hud";

export const Route = createFileRoute("/perms")({
  head: () => ({
    meta: [
      { title: "Permission Grid — Apex Signal Watch" },
      {
        name: "description",
        content:
          "Live web-permission matrix with WebHID companion control and RSSI trilateration for nearby devices, straight from the watch browser.",
      },
      { property: "og:title", content: "Permission Grid — Apex Signal Watch" },
      {
        property: "og:description",
        content:
          "Grant, probe and drive every browser capability: HID companions, serial, USB, Bluetooth, sensors — plus a live trilateration solve.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PermsScreen,
});

const TONE: Record<PermState, string> = {
  granted: "text-signal border-signal/60",
  denied: "text-alert border-alert/60",
  prompt: "text-warn border-warn/60",
  unsupported: "text-muted-foreground border-border",
  unknown: "text-scan border-scan/50",
};

function PermsScreen() {
  const { allows } = useTier();
  const [state, setState] = useState<Record<string, PermState>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [coords, setCoords] = useState<Record<string, { x: number; y: number }>>({});
  const [rssi, setRssi] = useState<Record<string, number>>({});
  const [fix, setFix] = useState<Fix | null>(null);
  const [disabled, setDisabled] = useState<Record<string, boolean>>({});
  const stops = useRef<(() => void)[]>([]);

  // Solo mode state
  const [soloMode, setSoloMode] = useState(false);
  const [pointMan, setPointMan] = useState<PointMan | null>(null);
  const [geoValidation, setGeoValidation] = useState<GeometricValidation | null>(null);

  const hudAnchors: HudAnchor[] = companions.map((c) => ({
    id: c.id,
    name: c.name,
    x: coords[c.id]?.x ?? 0,
    y: coords[c.id]?.y ?? 0,
    rssi: rssi[c.id] ?? null,
    enabled: !disabled[c.id],
  }));

  const say = useCallback(
    (line: string) =>
      setLog((l) => [`${new Date().toLocaleTimeString()} ${line}`, ...l].slice(0, 40)),
    [],
  );

  const refresh = useCallback(async () => {
    setState(await readAll());
    const list = await listHid();
    setCompanions(list);
    setCoords((c) => {
      const next = { ...c };
      list.forEach((d, i) => {
        if (!next[d.id]) {
          const a = (i / Math.max(list.length, 3)) * Math.PI * 2;
          next[d.id] = { x: Math.round(Math.cos(a) * 8), y: Math.round(Math.sin(a) * 8) };
        }
      });
      return next;
    });
  }, []);

  useEffect(() => {
    void refresh();
    const currentStops = stops.current;
    return () => currentStops.forEach((s) => s());
  }, [refresh]);

  const grant = async (key: string) => {
    const row = PERMISSIONS.find((r) => r.key === key);
    if (!row) return;
    setBusy(key);
    try {
      if (!row.request) {
        say(`${row.label}: no request path — probe only`);
      } else {
        await row.request();
        say(`${row.label}: granted`);
      }
    } catch (e) {
      say(`${row.label}: ${(e as Error).message || "refused"}`);
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  const pair = async () => {
    setBusy("hid");
    try {
      const picked = await requestHid();
      say(picked.length ? `paired ${picked.map((p) => p.name).join(", ")}` : "chooser cancelled");
      await refresh();
    } catch (e) {
      say(`hid: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const listen = (c: Companion) => {
    const stop = watchCompanion(c, (r) => {
      setRssi((m) => ({ ...m, [c.id]: Math.round(r.rssi) }));
    });
    stops.current.push(stop);
    say(`listening on ${c.name}`);
  };

  const ping = async (c: Companion) => {
    try {
      await sendReport(c, 0, [0x01, 0x00]);
      say(`sent output report → ${c.name}`);
    } catch (e) {
      say(`${c.name}: ${(e as Error).message}`);
    }
  };

  const drop = async (c: Companion) => {
    try {
      await closeCompanion(c);
      say(`closed ${c.name}`);
      void refresh();
    } catch (e) {
      say(`${c.name}: ${(e as Error).message}`);
    }
  };

  const solve = async () => {
    setBusy("solve");
    try {
      const anchors: Anchor[] = companions
        .filter((c) => rssi[c.id] != null && !disabled[c.id])
        .map((c) => ({
          id: c.id,
          x: coords[c.id]?.x ?? 0,
          y: coords[c.id]?.y ?? 0,
          rssi: rssi[c.id]!,
        }));

      const result = await callTier("pro", async () => trilaterate(anchors));
      setFix(result);

      // Calculate geometric validation if fix is valid
      if (result && anchors.length >= 3) {
        const validation = validateGeometry(anchors, result);
        setGeoValidation(validation);
        const conf = solveConfidence(result, validation);
        say(
          result
            ? `fix x=${result.x.toFixed(1)} y=${result.y.toFixed(1)} ±${result.radius.toFixed(1)}m conf=${(conf * 100).toFixed(0)}%`
            : "need 3+ live anchors",
        );
      } else {
        say(
          result
            ? `fix x=${result.x.toFixed(1)} y=${result.y.toFixed(1)} ±${result.radius.toFixed(1)}m`
            : "need 3+ live anchors",
        );
      }
    } catch (e) {
      say(e instanceof TierLocked ? "trilateration requires Pro" : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Solo mode: set point man reference node
  const setPointManRef = useCallback(async () => {
    if (!fix) {
      say("need valid fix before setting point man");
      return;
    }
    const pm: PointMan = {
      id: `pm_${Date.now()}`,
      x: fix.x,
      y: fix.y,
      timestamp: Date.now(),
    };
    setPointMan(pm);
    say(`point man set at x=${pm.x.toFixed(1)} y=${pm.y.toFixed(1)}`);
  }, [fix, say]);

  // Solo mode: solve with self-validation
  const solveSolo = useCallback(async () => {
    if (!fix) {
      say("run squad solve first to establish position");
      return;
    }

    setBusy("solo-solve");
    try {
      const anchors: Anchor[] = companions
        .filter((c) => rssi[c.id] != null && !disabled[c.id])
        .map((c) => ({
          id: c.id,
          x: coords[c.id]?.x ?? 0,
          y: coords[c.id]?.y ?? 0,
          rssi: rssi[c.id]!,
        }));

      if (anchors.length < 3) {
        say("solo mode needs 3+ live anchors for validation");
        setBusy(null);
        return;
      }

      // Validate against geometric patterns
      const validation = validateGeometry(anchors, fix);
      setGeoValidation(validation);

      const conf = solveConfidence(fix, validation);
      if (validation.isValid) {
        say(
          `solo solve valid: geometry=${(validation.score * 100).toFixed(0)}% conf=${(conf * 100).toFixed(0)}%`,
        );
      } else {
        say(`solo solve warning: geometry score low ${(validation.score * 100).toFixed(0)}%`);
      }
    } catch (e) {
      say((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, [fix, companions, coords, rssi, disabled, say]);

  const groups = ["device", "sensor", "media", "net", "system"] as const;

  return (
    <main className="no-scrollbar min-h-app overflow-y-auto scan-grid face-pad pb-8 pt-2">
      <header className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-signal">
            Permission Grid
          </h1>
          <p className="truncate text-[8px] uppercase tracking-widest text-muted-foreground">
            web capability bus · hid companions
          </p>
        </div>
        <Link
          to="/app"
          className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground active:text-signal"
        >
          ◉
        </Link>
      </header>

      {groups.map((g) => (
        <section key={g} className="mb-2">
          <h2 className="mb-1 text-[8px] uppercase tracking-[0.25em] text-muted-foreground">{g}</h2>
          <div className="grid grid-cols-[repeat(var(--face-cols),minmax(0,1fr))] gap-1.5">
            {PERMISSIONS.filter((p) => p.group === g).map((p) => {
              const st = state[p.key] ?? "unknown";
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={busy === p.key || st === "unsupported"}
                  onClick={() => void grant(p.key)}
                  className={`rounded-sm border bg-card/70 px-2 py-1.5 text-left active:bg-accent disabled:opacity-50 ${TONE[st]}`}
                >
                  <span className="block truncate text-[9px] font-bold uppercase tracking-widest">
                    {p.label}
                  </span>
                  <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                    {busy === p.key ? "asking…" : st}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <section className="mb-2 rounded-sm border border-scan/50 bg-card/70 p-2">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] text-scan">
            Companions · WebHID
          </h2>
          <button
            type="button"
            onClick={() => void pair()}
            className="rounded-sm border border-scan/60 px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-scan active:bg-accent"
          >
            pair
          </button>
        </div>
        {companions.length === 0 ? (
          <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
            no granted devices — tap pair and pick a puck, gamepad or ble dongle
          </p>
        ) : (
          companions.map((c) => (
            <div key={c.id} className="mb-1.5 rounded-sm border border-border px-2 py-1.5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-[9px] font-bold uppercase tracking-widest text-signal">
                    {c.name}
                  </span>
                  <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                    {c.id} · {c.usage}
                  </span>
                </span>
                <span className="shrink-0 text-[9px] text-warn">
                  {rssi[c.id] != null
                    ? `${rssi[c.id]}dBm · ${rssiToMetres(rssi[c.id]!).toFixed(1)}m`
                    : "—"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => listen(c)}
                  className="rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-signal active:bg-accent"
                >
                  listen
                </button>
                <button
                  type="button"
                  onClick={() => void ping(c)}
                  className="rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-warn active:bg-accent"
                >
                  report
                </button>
                <button
                  type="button"
                  onClick={() => void drop(c)}
                  className="rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-alert active:bg-accent"
                >
                  close
                </button>
                {(["x", "y"] as const).map((axis) => (
                  <label
                    key={axis}
                    className="flex items-center gap-1 text-[8px] uppercase text-muted-foreground"
                  >
                    {axis}
                    <input
                      type="number"
                      value={coords[c.id]?.[axis] ?? 0}
                      onChange={(e) =>
                        setCoords((m) => ({
                          ...m,
                          [c.id]: { x: 0, y: 0, ...m[c.id], [axis]: Number(e.target.value) },
                        }))
                      }
                      className="w-12 rounded-sm border border-input bg-background px-1 py-0.5 text-[9px] text-signal"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="mb-2 rounded-sm border border-signal/50 bg-card/70 p-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] text-signal">
            Trilateration {allows("pro") ? "" : "· pro"}
          </h2>
          <button
            type="button"
            disabled={busy === "solve"}
            onClick={() => void solve()}
            className="rounded-sm border border-signal/60 px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-signal active:bg-accent disabled:opacity-50"
          >
            solve
          </button>
        </div>
        <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
          least-squares solve over live companion rssi — needs three anchors with coordinates
        </p>
        {fix ? (
          <p className="mt-1 text-[10px] text-warn">
            x {fix.x.toFixed(2)}m · y {fix.y.toFixed(2)}m · ±{fix.radius.toFixed(2)}m ·{" "}
            {fix.anchors} anchors
          </p>
        ) : null}
      </section>

      <section className="mb-2">
        <TrilaterationHUD
          anchors={hudAnchors}
          fix={fix}
          onToggle={(id) => setDisabled((d) => ({ ...d, [id]: !d[id] }))}
        />
      </section>

      {/* Solo Mode Controls */}
      <section className="mb-2 rounded-sm border border-amber-500/50 bg-amber-950/20 p-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-400">
            Solo Mode · Point Man
          </h2>
          <button
            type="button"
            onClick={() => setSoloMode(!soloMode)}
            aria-pressed={soloMode}
            className={`rounded-sm border px-1.5 py-0.5 text-[8px] uppercase tracking-widest transition-colors ${
              soloMode
                ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                : "border-border text-muted-foreground"
            }`}
          >
            {soloMode ? "on" : "off"}
          </button>
        </div>
        <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
          self-validation with geometric patterns · independent positioning
        </p>

        {soloMode ? (
          <>
            <div className="mt-2 flex gap-1">
              <button
                type="button"
                disabled={!fix || busy === "solo-solve"}
                onClick={() => void setPointManRef()}
                className="flex-1 rounded-sm border border-amber-500/60 bg-amber-500/10 px-2 py-1 text-[7px] uppercase tracking-widest text-amber-400 active:bg-amber-500/20 disabled:opacity-50"
              >
                Set Point Man
              </button>
              <button
                type="button"
                disabled={!fix || busy === "solo-solve"}
                onClick={() => void solveSolo()}
                className="flex-1 rounded-sm border border-amber-500/60 bg-amber-500/10 px-2 py-1 text-[7px] uppercase tracking-widest text-amber-400 active:bg-amber-500/20 disabled:opacity-50"
              >
                Validate Solo
              </button>
            </div>

            {pointMan ? (
              <p className="mt-1 text-[8px] text-amber-400">
                ◆ point man x {pointMan.x.toFixed(2)}m y {pointMan.y.toFixed(2)}m
              </p>
            ) : null}

            {geoValidation ? (
              <div className="mt-1.5 grid grid-cols-2 gap-1 text-[7px] text-muted-foreground">
                <div className="rounded-sm border border-border bg-card/40 p-1">
                  <span className="block text-[6px] text-amber-400">geometry</span>
                  <span className="text-amber-400">
                    {(geoValidation.geometryQuality * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="rounded-sm border border-border bg-card/40 p-1">
                  <span className="block text-[6px] text-amber-400">bearing</span>
                  <span className="text-amber-400">
                    {(geoValidation.bearingConsistency * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="rounded-sm border border-border bg-card/60 p-2">
        <h2 className="mb-1 text-[8px] uppercase tracking-[0.25em] text-muted-foreground">Log</h2>
        <div className="no-scrollbar max-h-40 overflow-y-auto">
          {log.length === 0 ? (
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground">idle</p>
          ) : (
            log.map((l, i) => (
              <p key={i} className="truncate text-[8px] text-signal">
                {l}
              </p>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
