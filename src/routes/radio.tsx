import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import { useBridge } from "@/lib/bridge-context";
import {
  NETWORK_MODES,
  RADIO_GROUPS,
  modeCmd,
  parseRadioRows,
  pickDbm,
  type RadioAction,
} from "@/lib/radio";

export const Route = createFileRoute("/radio")({
  head: () => ({
    meta: [
      { title: "Radio Lab — Apex Signal Watch" },
      {
        name: "description",
        content:
          "Fine-grain AOSP radio control from the watch: RadioInfo, band/network mode, modem power, GNSS diagnostics and raw RIL logs over the ADB bridge.",
      },
      { property: "og:title", content: "Radio Lab — Apex Signal Watch" },
      {
        property: "og:description",
        content:
          "Pixel-style hidden radio controls on the LOKMAT: preferred network mode, cell survey, GNSS metrics and kernel modem readouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RadioScreen,
});

function RadioScreen() {
  const { run, state } = useBridge();
  const [busy, setBusy] = useState<string | null>(null);
  const [title, setTitle] = useState("no readout yet");
  const [rows, setRows] = useState<[string, string][]>([]);
  const [dbm, setDbm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [mode, setMode] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const exec = useCallback(
    async (key: string, label: string, cmd: string) => {
      if (state !== "online") {
        setError("no bridge link — connect on /bridge first");
        return;
      }
      setBusy(key);
      setError(null);
      try {
        const raw = await run(cmd);
        setTitle(label);
        setRows(parseRadioRows(raw));
        setDbm(pickDbm(raw));
        setLog((l) => [`${label} ✓`, ...l].slice(0, 12));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "command failed";
        setError(`${label}: ${msg}`);
        setLog((l) => [`${label} ✕ ${msg}`, ...l].slice(0, 12));
      } finally {
        setBusy(null);
        setConfirm(null);
      }
    },
    [run, state],
  );

  const tap = (a: RadioAction) => {
    if (a.risky && confirm !== a.key) {
      setConfirm(a.key);
      return;
    }
    void exec(a.key, a.label, a.cmd);
  };

  return (
    <div className="h-app w-full overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex max-w-xl flex-col gap-3 p-[var(--pad)] pb-16">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-sm font-bold tracking-widest text-signal">RADIO LAB</h1>
            <p className="text-[10px] text-muted-foreground">AOSP 10 fine-grain modem + GNSS</p>
          </div>
          <Link
            to="/app"
            className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground"
          >
            ← home
          </Link>
        </header>

        <div
          className={`rounded border px-2 py-1 text-[10px] ${
            state === "online" ? "border-signal/60 text-signal" : "border-alert/60 text-alert"
          }`}
        >
          bridge {state}
          {dbm !== null ? ` · ${dbm} dBm` : ""}
        </div>

        {/* Preferred network mode — the band/tech lock RadioInfo exposes */}
        <section className="rounded border border-border p-2">
          <h2 className="text-[11px] font-bold tracking-wider text-scan">NETWORK MODE</h2>
          <p className="mb-2 text-[10px] text-muted-foreground">
            Writes global preferred_network_mode — same knob as RadioInfo's "set preferred network
            type".
          </p>
          <div className="grid grid-cols-2 gap-1">
            {NETWORK_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  setMode(m.value);
                  void exec(`mode-${m.value}`, `mode ${m.label}`, modeCmd(m.value));
                }}
                className={`rounded border px-2 py-2 text-left text-[10px] ${
                  mode === m.value ? "border-signal text-signal" : "border-border text-foreground"
                } ${busy === `mode-${m.value}` ? "opacity-50" : ""}`}
              >
                <span className="block font-bold">{m.value}</span>
                {m.label}
              </button>
            ))}
          </div>
        </section>

        {RADIO_GROUPS.map((g) => (
          <section key={g.key} className="rounded border border-border p-2">
            <h2 className="text-[11px] font-bold tracking-wider text-scan">
              {g.title.toUpperCase()}
            </h2>
            <p className="mb-2 text-[10px] text-muted-foreground">{g.note}</p>
            <div className="grid grid-cols-2 gap-1">
              {g.actions.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => tap(a)}
                  className={`rounded border px-2 py-2 text-left text-[10px] ${
                    confirm === a.key ? "border-warn text-warn" : "border-border text-foreground"
                  } ${busy === a.key ? "opacity-50" : ""}`}
                >
                  <span className="block font-bold">
                    {confirm === a.key ? "tap again" : a.label}
                  </span>
                  <span className="block truncate text-muted-foreground">{a.sub}</span>
                </button>
              ))}
            </div>
          </section>
        ))}

        {error && (
          <div className="rounded border border-alert/60 px-2 py-1 text-[10px] text-alert">
            {error}
          </div>
        )}

        <section className="rounded border border-border p-2">
          <h2 className="text-[11px] font-bold tracking-wider text-scan">{title.toUpperCase()}</h2>
          {rows.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">Run a readout above.</p>
          ) : (
            <ul className="mt-1 space-y-[2px]">
              {rows.map(([k, v], i) => (
                <li key={`${k}-${i}`} className="flex gap-2 text-[10px] leading-tight">
                  <span className="shrink-0 max-w-[45%] truncate text-signal">{k}</span>
                  <span className="truncate text-muted-foreground">{v}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {log.length > 0 && (
          <section className="rounded border border-border p-2">
            <h2 className="text-[11px] font-bold tracking-wider text-scan">LOG</h2>
            <ul className="mt-1 space-y-[2px]">
              {log.map((l, i) => (
                <li key={i} className="truncate text-[10px] text-muted-foreground">
                  {l}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
