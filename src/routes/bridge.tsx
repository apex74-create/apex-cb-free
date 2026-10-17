import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { COMMANDS } from "@/lib/adb-commands";
import { KIND_LABEL, consumePairingLink } from "@/lib/bridge";
import { toneClass, toneBorder } from "@/lib/tools";
import { useBridge } from "@/lib/bridge-context";
import BridgeSettings from "@/components/BridgeSettings";
import AmbientPanel from "@/components/AmbientPanel";
import BlePanel from "@/components/BlePanel";
import OneTapLink from "@/components/OneTapLink";
import MeshNodePanel from "@/components/MeshNodePanel";
import OperatorGate from "@/components/OperatorGate";
import SessionExport from "@/components/SessionExport";
import WifiPanel from "@/components/WifiPanel";

export const Route = createFileRoute("/bridge")({
  head: () => ({
    meta: [
      { title: "ADB Bridge — Apex Signal Watch" },
      {
        name: "description",
        content:
          "Watch-to-phone ADB bridge: live WebSocket link to a PC, phone or relay agent with one-tap adb shell commands.",
      },
      { property: "og:title", content: "ADB Bridge — Apex Signal Watch" },
      {
        property: "og:description",
        content:
          "Run adb shell commands from a LOKMAT watch over Wi-Fi or 4G with automatic agent failover.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <OperatorGate><BridgeView /></OperatorGate>,
});

const stateTone = {
  idle: "text-muted-foreground",
  connecting: "text-warn",
  agent: "text-scan",
  online: "text-signal",
  failing: "text-warn",
  offline: "text-alert",
} as const;

function BridgeView() {
  const {
    endpoints,
    setEndpoints,
    target,
    setTarget,
    activeId,
    state,
    diagnosis,
    log,
    latency,
    send,
    pairDevice,
    connectDevice,
    findDevice,
    retryNow,
    clearLog,
    autoLink,
  } = useBridge();

  // Phone installer opens /bridge#pair=<token>: save it and dial straight away.
  useEffect(() => {
    const paired = consumePairingLink(endpoints);
    if (!paired) return;
    setEndpoints(paired);
    const t = setTimeout(() => void autoLink(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tab, setTab] = useState<"deck" | "log">("deck");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // A finished command should surface immediately.
  useEffect(() => {
    if (log[0]?.kind === "out" || log[0]?.kind === "err") setTab("log");
  }, [log]);

  const active = endpoints.find((e) => e.id === activeId);

  return (
    <main className="relative flex h-app w-full flex-col overflow-hidden bg-background">
      <header className="z-10 grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background/90 face-pad py-1.5">
        <Link
          to="/app"
          aria-label="Back to gallery"
          className="shrink-0 px-1 text-[12px] leading-none text-muted-foreground active:text-signal"
        >
          ‹
        </Link>
        <h1 className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.2em] text-signal">
          ADB BRIDGE
        </h1>
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="Bridge settings"
          className="shrink-0 px-1 text-[11px] leading-none text-muted-foreground active:text-signal"
        >
          ⚙
        </button>
      </header>

      <div className="z-10 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border face-pad py-1">
        <button
          type="button"
          onClick={retryNow}
          className="min-w-0 text-left"
          aria-label="Reconnect bridge"
        >
          <span
            className={`block truncate text-[9px] uppercase tracking-widest ${stateTone[state]}`}
          >
            {state === "online" ? "● " : "○ "}
            {diagnosis ? "stopped" : state} · {active ? KIND_LABEL[active.kind] : "no agent"}
          </span>
          <span
            className={`block text-[8px] uppercase tracking-wider ${
              diagnosis ? "whitespace-normal text-warn" : "truncate text-muted-foreground"
            }`}
          >
            {diagnosis ??
              `${active?.url ?? "configure endpoints"}${latency !== null ? ` · ${latency}ms` : ""}`}
          </span>
          {diagnosis ? (
            <span className="block text-[8px] uppercase tracking-widest text-signal">
              tap to retry
            </span>
          ) : null}
        </button>

        <div className="flex shrink-0 gap-1">
          {(["deck", "log"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-sm border px-1.5 py-0.5 text-[8px] uppercase tracking-widest ${
                tab === t ? "border-signal text-signal" : "border-border text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <section className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto face-pad py-2">
        <BlePanel />
        <AmbientPanel />
        <div className="pb-2">
          <OneTapLink />
        </div>
        {tab === "deck" ? (
          <>
            <MeshNodePanel />
            <WifiPanel />
            <ul className="grid grid-cols-[repeat(var(--face-cols,2),minmax(0,1fr))] gap-1.5">
              {COMMANDS.map((command) => (
                <li key={command.key}>
                  <button
                    type="button"
                    onClick={() => send(command.cmd)}
                    disabled={state !== "online"}
                    className={`w-full rounded-sm border ${toneBorder[command.tone]} bg-card/70 px-2 py-2 text-left transition-colors active:bg-accent disabled:opacity-40`}
                  >
                    <span
                      className={`block truncate text-[9px] font-bold uppercase tracking-widest ${toneClass[command.tone]}`}
                    >
                      {command.write ? "! " : ""}
                      {command.label}
                    </span>
                    <span className="block truncate text-[8px] tracking-wider text-muted-foreground">
                      {command.cmd}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <ul className="space-y-1">
              {log.length === 0 ? (
                <li className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  no traffic yet
                </li>
              ) : (
                log.map((line) => (
                  <li
                    key={line.id}
                    className={`whitespace-pre-wrap break-words border-l-2 pl-1.5 text-[9px] leading-snug ${
                      line.kind === "err"
                        ? "border-alert text-alert"
                        : line.kind === "sent"
                          ? "border-warn text-warn"
                          : line.kind === "sys"
                            ? "border-border text-muted-foreground"
                            : "border-signal text-signal"
                    }`}
                  >
                    {line.text}
                  </li>
                ))
              )}
            </ul>
            <SessionExport snapshot={{ state, latency, activeId, target, endpoints, log }} />
          </>
        )}

        {settingsOpen ? (
          <BridgeSettings
            endpoints={endpoints}
            target={target}
            onTargetChange={setTarget}
            onPair={pairDevice}
            onConnect={connectDevice}
            onFind={findDevice}
            activeId={activeId}
            state={state}
            diagnosis={diagnosis}
            onChange={setEndpoints}
            onClose={() => setSettingsOpen(false)}
          />
        ) : null}
      </section>

      <footer className="z-10 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border bg-background/90 face-pad py-1">
        <p className="min-w-0 truncate text-[8px] uppercase tracking-widest text-muted-foreground">
          {endpoints
            .filter((e) => e.enabled)
            .map((e) => KIND_LABEL[e.kind])
            .join(" → ") || "no agents"}
        </p>
        <button
          type="button"
          onClick={clearLog}
          className="shrink-0 text-[8px] uppercase tracking-widest text-muted-foreground active:text-signal"
        >
          clear
        </button>
      </footer>
    </main>
  );
}
