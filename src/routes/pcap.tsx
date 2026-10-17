import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { daemonUrl, usePhoneLanIp } from "@/lib/lan-ip";
import { useBridge } from "@/lib/bridge-context";
import PcapReplay from "@/components/PcapReplay";
import OperatorGate from "@/components/OperatorGate";
import {
  consentWarning,
  DEFAULT_PCAP_SETTINGS,
  dumpsCmd,
  formatBytes,
  installedCmd,
  keylogCmd,
  mitmInstalledCmd,
  listenCmd,
  loadPcapSettings,
  parseAmResult,
  parseIpv4,
  parseNetDev,
  parseVersion,
  phoneIpCmd,
  runningCmd,
  savePcapSettings,
  serviceCmd,
  startCmd,
  statusIntentCmd,
  stopCmd,
  tunCmd,
  tunStatsCmd,
  versionCmd,
  type DumpMode,
  type PcapSettings,
} from "@/lib/pcapdroid";

export const Route = createFileRoute("/pcap")({
  head: () => ({
    meta: [
      { title: "PCAPdroid Capture — Apex Signal Watch" },
      {
        name: "description",
        content:
          "Drive a real PCAPdroid packet capture on your phone from the watch: start, stop, dump mode, live interface counters and the PCAP download URL.",
      },
      { property: "og:title", content: "PCAPdroid Capture — Apex Signal Watch" },
      {
        property: "og:description",
        content:
          "Watch-side control for PCAPdroid's Intent API over the ADB bridge — no simulation, real capture only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <OperatorGate><PcapView /></OperatorGate>,
});

const MODES: { id: DumpMode; label: string }[] = [
  { id: "http_server", label: "HTTP" },
  { id: "pcap_file", label: "FILE" },
  { id: "udp_exporter", label: "UDP" },
  { id: "none", label: "NONE" },
];

function PcapView() {
  const { state, run } = useBridge();
  const [settings, setSettings] = useState<PcapSettings>(DEFAULT_PCAP_SETTINGS);
  const [tab, setTab] = useState<"live" | "conf">("live");
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [capturing, setCapturing] = useState<boolean | null>(null);
  const [tunIp, setTunIp] = useState<string | null>(null);
  const [phoneIp, setPhoneIp] = useState<string | null>(null);
  const [counters, setCounters] = useState<{ iface: string; bytes: number; packets: number }[]>([]);
  const [dumps, setDumps] = useState<string[]>([]);
  const [mitm, setMitm] = useState<boolean | null>(null);
  const [keylogs, setKeylogs] = useState<string[]>([]);
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const baseRef = useRef<Record<string, { bytes: number; packets: number }>>({});
  const { iface: lanIface, error: lanError, refresh: refreshLan } = usePhoneLanIp();

  useEffect(() => setSettings(loadPcapSettings()), []);

  const patch = (p: Partial<PcapSettings>) =>
    setSettings((prev) => {
      const next = { ...prev, ...p };
      savePcapSettings(next);
      return next;
    });

  const refresh = useCallback(async () => {
    if (state !== "online") return;
    try {
      const [inst, ver, pid, svc, tun, ip, dev, files, mitmOut, keys] = await Promise.all([
        run(installedCmd).catch(() => ""),
        run(versionCmd).catch(() => ""),
        run(runningCmd).catch(() => ""),
        run(serviceCmd).catch(() => "0"),
        run(tunCmd).catch(() => ""),
        run(phoneIpCmd).catch(() => ""),
        run(tunStatsCmd).catch(() => ""),
        run(dumpsCmd).catch(() => ""),
        run(mitmInstalledCmd).catch(() => ""),
        run(keylogCmd).catch(() => ""),
      ]);
      setMitm(mitmOut.includes("package:"));
      setKeylogs(
        keys
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => /\.(txt|log)$|keylog/i.test(l)),
      );
      setInstalled(inst.includes("package:"));
      setVersion(parseVersion(ver));
      // The foreground CaptureService is the honest signal: it exists only
      // while a capture runs, in VPN and root mode alike. tun0 is VPN-only and
      // pidof is true whenever the app is merely open.
      const serviceUp = Number(svc.trim().split("\n").pop()) > 0;
      const alive = /\d/.test(pid.trim());
      const tunUp = /inet\s/.test(tun);
      setCapturing(serviceUp || (alive && tunUp && !settings.rootCapture));
      setTunIp(parseIpv4(tun));
      setPhoneIp(parseIpv4(ip));
      setCounters(
        parseNetDev(dev).map((c) => {
          const total = { bytes: c.rxBytes + c.txBytes, packets: c.rxPackets + c.txPackets };
          const base = baseRef.current[c.iface];
          if (!base) baseRef.current[c.iface] = total;
          const b = baseRef.current[c.iface]!;
          return {
            iface: c.iface,
            bytes: total.bytes - b.bytes,
            packets: total.packets - b.packets,
          };
        }),
      );
      setDumps(
        files
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => /\.pcapng?$/.test(l)),
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : "read failed");
    }
  }, [run, state, settings.rootCapture]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const fire = async (cmd: string, label: string) => {
    setBusy(true);
    setNote(`${label}…`);
    try {
      const out = await run(cmd, 15000);
      if (label === "start" || label === "stop" || label === "status") {
        // `am start -W` reports the activity result: RESULT_OK means PCAPdroid
        // accepted the intent, anything else is a refusal worth showing.
        const { ok, detail } = parseAmResult(out);
        setNote(ok ? `${label} accepted` : detail);
      } else {
        setNote(out.trim().split("\n").slice(-1)[0] || `${label} sent`);
      }
      if (label === "start") baseRef.current = {};
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setBusy(false);
    }
  };

  const consent = consentWarning(version, settings.apiKey);

  const offline = state !== "online";
  // Phone LAN address is detected automatically (best routable interface, never
  // loopback or the PCAPdroid tun0), so nothing has to be copied by hand.
  const lanIp = lanIface?.ip ?? phoneIp;
  const autoUrl = daemonUrl(lanIp, settings.httpPort);
  const downloadUrl = settings.dumpMode === "http_server" ? autoUrl : null;

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
        <h1 className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.2em] text-scan">
          PCAPDROID
        </h1>
        <button
          type="button"
          onClick={() => setTab((t) => (t === "live" ? "conf" : "live"))}
          className="shrink-0 rounded-sm border border-border px-1 text-[8px] uppercase tracking-widest text-muted-foreground active:text-scan"
        >
          {tab === "live" ? "conf" : "live"}
        </button>
      </header>

      <div className="z-10 shrink-0 border-b border-border face-pad py-1">
        <span
          className={`block truncate text-[9px] uppercase tracking-widest ${
            offline ? "text-alert" : capturing ? "text-signal" : "text-warn"
          }`}
        >
          {offline
            ? "○ no bridge — link required"
            : installed === false
              ? "○ pcapdroid not installed"
              : capturing
                ? "● capturing"
                : "○ idle"}
        </span>
        <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
          {version ? `v${version} · ` : ""}
          {settings.dumpMode}
          {tunIp ? ` · tun ${tunIp}` : ""}
        </span>
      </div>

      {tab === "live" ? (
        <div className="min-h-0 flex-1 overflow-y-auto face-pad py-2">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={offline || busy}
              onClick={() => void fire(startCmd(settings), "start")}
              className="rounded-sm border border-signal/50 bg-card/70 py-2 text-[10px] font-bold uppercase tracking-widest text-signal active:bg-accent disabled:opacity-40"
            >
              START
            </button>
            <button
              type="button"
              disabled={offline || busy}
              onClick={() => void fire(stopCmd(settings), "stop")}
              className="rounded-sm border border-alert/50 bg-card/70 py-2 text-[10px] font-bold uppercase tracking-widest text-alert active:bg-accent disabled:opacity-40"
            >
              STOP
            </button>
            <button
              type="button"
              disabled={offline || busy}
              onClick={() => void fire(statusIntentCmd(settings), "status")}
              className="rounded-sm border border-border bg-card/70 py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground active:bg-accent disabled:opacity-40"
            >
              STATUS
            </button>
            <button
              type="button"
              disabled={offline || busy}
              onClick={() => void fire(listenCmd(settings.httpPort), "port")}
              className="rounded-sm border border-border bg-card/70 py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground active:bg-accent disabled:opacity-40"
            >
              PORT
            </button>
          </div>

          <p className="mt-2 break-words text-[8px] uppercase tracking-wider text-muted-foreground">
            {note || "controls pcapdroid via its intent api over adb"}
          </p>
          {consent ? (
            <p className="mt-1 break-words text-[8px] uppercase tracking-wider text-warn">
              {consent}
            </p>
          ) : null}

          <h2 className="mt-3 text-[8px] uppercase tracking-widest text-scan">
            counters since start
          </h2>
          {counters.length === 0 ? (
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground">no source</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {counters.map((c) => (
                <li key={c.iface} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 text-[9px]">
                  <span className="text-warn">{c.iface}</span>
                  <span className="truncate text-right text-muted-foreground">
                    {formatBytes(c.bytes)} · {c.packets} pkt
                  </span>
                </li>
              ))}
            </ul>
          )}

          {downloadUrl ? (
            <>
              <h2 className="mt-3 text-[8px] uppercase tracking-widest text-scan">pcap stream</h2>
              <a
                href={downloadUrl}
                className="block truncate text-[9px] text-signal underline"
                target="_blank"
                rel="noreferrer"
              >
                {downloadUrl}
              </a>
            </>
          ) : null}

          {keylogs.length > 0 ? (
            <>
              <h2 className="mt-3 text-[8px] uppercase tracking-widest text-scan">
                tls secrets (sslkeylogfile)
              </h2>
              <ul className="mt-1 space-y-0.5">
                {keylogs.map((k) => (
                  <li key={k} className="truncate text-[8px] text-muted-foreground">
                    {k}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {dumps.length > 0 ? (
            <>
              <h2 className="mt-3 text-[8px] uppercase tracking-widest text-scan">
                dumps on device
              </h2>
              <ul className="mt-1 space-y-0.5">
                {dumps.map((d) => (
                  <li key={d} className="truncate text-[8px] text-muted-foreground">
                    {d}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto face-pad py-2">
          <h2 className="text-[8px] uppercase tracking-widest text-scan">dump mode</h2>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => patch({ dumpMode: m.id })}
                className={`rounded-sm border py-1 text-[8px] uppercase tracking-widest ${
                  settings.dumpMode === m.id
                    ? "border-scan/60 text-scan"
                    : "border-border text-muted-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <Field label="api key" value={settings.apiKey} onChange={(v) => patch({ apiKey: v })} />
          {settings.dumpMode === "http_server" ? (
            <>
              <Field
                label="http port"
                value={String(settings.httpPort)}
                onChange={(v) => patch({ httpPort: Number(v) || 8080 })}
              />
              <h2 className="mt-3 text-[8px] uppercase tracking-widest text-scan">
                daemon url · auto-detected
              </h2>
              <p className="mt-0.5 break-all text-[9px] text-signal">
                {autoUrl ?? (lanIface ? "—" : "detecting phone lan ip…")}
              </p>
              <p className="mt-0.5 truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                {lanIface
                  ? `${lanIface.name} · /${lanIface.cidr}`
                  : (lanError ?? "bridge link required")}
              </p>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  disabled={!autoUrl}
                  onClick={() => void navigator.clipboard?.writeText(autoUrl ?? "")}
                  className="rounded-sm border border-signal py-1 text-[8px] uppercase tracking-widest text-signal disabled:opacity-40"
                >
                  copy url
                </button>
                <button
                  type="button"
                  onClick={() => refreshLan()}
                  className="rounded-sm border border-border py-1 text-[8px] uppercase tracking-widest text-muted-foreground active:text-signal"
                >
                  re-detect
                </button>
              </div>
              <p className="mt-1 break-words text-[8px] uppercase tracking-wider text-warn">
                loopback is never used — the routable interface address above is picked
                automatically (127.0.0.1 only exists inside the phone and makes the relay return
                http 400).
              </p>
            </>
          ) : null}

          {settings.dumpMode === "udp_exporter" ? (
            <>
              <Field
                label="collector host"
                value={settings.collectorHost}
                onChange={(v) => patch({ collectorHost: v })}
              />
              <Field
                label="collector port"
                value={String(settings.collectorPort)}
                onChange={(v) => patch({ collectorPort: Number(v) || 5123 })}
              />
            </>
          ) : null}
          {settings.dumpMode === "pcap_file" ? (
            <Field
              label="pcap name"
              value={settings.pcapName}
              onChange={(v) => patch({ pcapName: v })}
            />
          ) : null}
          <Field
            label="app filter (pkg)"
            value={settings.appFilter}
            onChange={(v) => patch({ appFilter: v })}
          />
          <Field
            label="capture interface"
            value={settings.captureInterface}
            onChange={(v) => patch({ captureInterface: v })}
          />
          <label className="mt-2 flex items-center gap-2 text-[9px] uppercase tracking-wider text-muted-foreground">
            <input
              type="checkbox"
              checked={settings.rootCapture}
              onChange={(e) => patch({ rootCapture: e.target.checked })}
              className="h-3 w-3 accent-current"
            />
            root capture
          </label>

          <h2 className="mt-3 text-[8px] uppercase tracking-widest text-scan">
            https / tls decryption
          </h2>
          <label className="mt-1 flex items-center gap-2 text-[9px] uppercase tracking-wider text-muted-foreground">
            <input
              type="checkbox"
              checked={settings.tlsDecryption}
              onChange={(e) => patch({ tlsDecryption: e.target.checked })}
              className="h-3 w-3 accent-current"
            />
            decrypt tls
          </label>
          <label className="mt-1 flex items-center gap-2 text-[9px] uppercase tracking-wider text-muted-foreground">
            <input
              type="checkbox"
              checked={settings.pcapngFormat}
              onChange={(e) => patch({ pcapngFormat: e.target.checked })}
              className="h-3 w-3 accent-current"
            />
            pcapng + keylog
          </label>
          <p
            className={`mt-1 break-words text-[8px] uppercase tracking-wider ${mitm === false ? "text-alert" : "text-muted-foreground"}`}
          >
            {mitm === false
              ? "mitm addon missing — install pcapdroid-mitm and trust its ca to decrypt"
              : mitm
                ? "mitm addon present · pcapng embeds the sslkeylogfile secrets"
                : "mitm addon state unknown — link the bridge"}
          </p>

          <p className="mt-3 break-words text-[8px] uppercase tracking-wider text-muted-foreground">
            pcapdroid must allow control: settings → control permissions. an api key is required
            unless the first intent is confirmed on the phone.
          </p>

          <PcapReplay />
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="mt-2 block">
      <span className="block text-[8px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCapitalize="none"
        className="mt-0.5 w-full rounded-sm border border-border bg-card/70 px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-scan/60"
      />
    </label>
  );
}
