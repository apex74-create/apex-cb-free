/**
 * PCAPdroid control layer.
 *
 * PCAPdroid (emanuele-f/PCAPdroid) exposes a documented Intent API through its
 * `CaptureCtrl` activity, so a bridge agent running `adb` can drive a real
 * capture on the phone. Nothing here simulates traffic: every value shown in
 * the UI comes from `adb` output or PCAPdroid's own HTTP server.
 *
 * Docs: https://github.com/emanuele-f/PCAPdroid/blob/master/docs/app_api.md
 */

export const PCAPDROID_PKG = "com.emanuelef.remote_capture";
export const CAPTURE_CTRL = `${PCAPDROID_PKG}/.activities.CaptureCtrl`;

export type DumpMode = "http_server" | "pcap_file" | "udp_exporter" | "none";

export type PcapSettings = {
  /** Optional API key configured in PCAPdroid → Settings → Control permissions */
  apiKey: string;
  dumpMode: DumpMode;
  /** http_server mode */
  httpPort: number;
  /** udp_exporter mode */
  collectorHost: string;
  collectorPort: number;
  /** pcap_file mode */
  pcapName: string;
  /** package name to restrict the capture to, empty = all apps */
  appFilter: string;
  /** "any" mirrors the in-app default and captures outside a VPN tunnel too */
  captureInterface: string;
  /** root capture bypasses the VPN service when the phone is rooted */
  rootCapture: boolean;
  /** decrypt HTTPS/TLS via the PCAPdroid mitm addon (1.6.4+) */
  tlsDecryption: boolean;
  /** pcapng dump embeds the TLS secrets (SSLKEYLOGFILE) alongside the packets */
  pcapngFormat: boolean;
};

export const DEFAULT_PCAP_SETTINGS: PcapSettings = {
  apiKey: "",
  dumpMode: "http_server",
  httpPort: 8080,
  collectorHost: "192.168.12.1",
  collectorPort: 5123,
  pcapName: "apex.pcap",
  appFilter: "",
  captureInterface: "any",
  rootCapture: false,
  tlsDecryption: false,
  pcapngFormat: false,
};

const KEY = "apex.pcapdroid.settings";

export function loadPcapSettings(): PcapSettings {
  if (typeof window === "undefined") return DEFAULT_PCAP_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PCAP_SETTINGS;
    return { ...DEFAULT_PCAP_SETTINGS, ...(JSON.parse(raw) as Partial<PcapSettings>) };
  } catch {
    return DEFAULT_PCAP_SETTINGS;
  }
}

export function savePcapSettings(s: PcapSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* watch storage can be locked down — settings just don't persist */
  }
}

const esc = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`;

/**
 * `am start -W` so adb prints the activity result code. Launched from adb there
 * is no calling package, so without an `api_key` PCAPdroid (1.8.6+) shows the
 * consent dialog on the phone instead of starting — generate the key in
 * PCAPdroid → Settings → Control Permissions → ⋮ → API key.
 */
const AM = `am start -W -a android.intent.action.VIEW`;

/** `adb shell am start ...` line that starts a capture with the given settings. */
export function startCmd(s: PcapSettings): string {
  const extras: string[] = ["-e action start", `-e pcap_dump_mode ${s.dumpMode}`];
  if (s.apiKey) extras.push(`-e api_key ${esc(s.apiKey)}`);
  if (s.dumpMode === "http_server") extras.push(`--ei http_server_port ${s.httpPort}`);
  if (s.dumpMode === "udp_exporter") {
    // collector_ip_address is deprecated; current builds take collector_host.
    extras.push(`-e collector_host ${esc(s.collectorHost)}`);
    extras.push(`--ei collector_port ${s.collectorPort}`);
  }
  if (s.dumpMode === "pcap_file") extras.push(`-e pcap_name ${esc(s.pcapName)}`);
  if (s.appFilter) extras.push(`-e app_filter ${esc(s.appFilter)}`);
  // capture_interface only applies in root mode.
  if (s.rootCapture) {
    extras.push("-e root_capture true");
    if (s.captureInterface) extras.push(`-e capture_interface ${esc(s.captureInterface)}`);
  }
  // TLS/HTTPS decryption needs the PCAPdroid-mitm addon installed and its CA
  // trusted on the phone. pcapng carries the TLS secrets (SSLKEYLOGFILE) inline
  // so Wireshark can open the dump already decrypted.
  if (s.tlsDecryption) extras.push("-e tls_decryption true");
  if (s.pcapngFormat) extras.push("-e pcapng_format true");
  return `shell ${AM} ${extras.join(" ")} -n ${CAPTURE_CTRL}`;
}

/** The separate mitm addon that performs the TLS decryption. */
export const MITM_PKG = "com.emanuelef.remote_capture.mitm";
export const mitmInstalledCmd = `shell pm path ${MITM_PKG}`;
/** Keylog / dump artefacts PCAPdroid writes next to the pcap files. */
export const keylogCmd = `shell ls -l /sdcard/Download/PCAPdroid/*.txt /sdcard/Download/PCAPdroid/*keylog* 2>/dev/null || echo ''`;

export function stopCmd(s: PcapSettings): string {
  const key = s.apiKey ? ` -e api_key ${esc(s.apiKey)}` : "";
  return `shell ${AM} -e action stop${key} -n ${CAPTURE_CTRL}`;
}

export function statusIntentCmd(s: PcapSettings): string {
  const key = s.apiKey ? ` -e api_key ${esc(s.apiKey)}` : "";
  return `shell ${AM} -e action get_status${key} -n ${CAPTURE_CTRL}`;
}

/** Is the app installed at all? */
export const installedCmd = `shell pm path ${PCAPDROID_PKG}`;
/** Version, straight from the package manager. */
export const versionCmd = `shell dumpsys package ${PCAPDROID_PKG} | grep -E 'versionName|versionCode' | head -2`;
/** Capture engine alive? PCAPdroid runs a foreground VPN service while capturing. */
export const runningCmd = `shell pidof ${PCAPDROID_PKG} || echo ''`;
/**
 * Authoritative capture check: the foreground CaptureService only exists while
 * a capture is running, in both VPN and root mode.
 */
export const serviceCmd = `shell dumpsys activity services ${PCAPDROID_PKG} 2>/dev/null | grep -c CaptureService || echo 0`;
/** The VPN tunnel PCAPdroid installs when capturing without root. */
export const tunCmd = `shell ip -f inet addr show tun0 2>/dev/null || echo ''`;
/** Phone LAN address — used to build the PCAP download URL. */
export const phoneIpCmd = `shell ip -f inet addr show wlan0 | grep inet || echo ''`;
/** Bytes/packets the VPN interface has moved since the capture started. */
export const tunStatsCmd = `shell cat /proc/net/dev | grep -E 'tun0|rmnet0' || echo ''`;
/** Files written in pcap_file mode — 1.6.0+ dumps to Download/PCAPdroid. */
export const dumpsCmd = `shell ls -l /sdcard/Download/PCAPdroid/ 2>/dev/null || echo ''`;

export function listenCmd(port: number): string {
  return `shell ss -ltn 2>/dev/null | grep ':${port}' || netstat -ltn 2>/dev/null | grep ':${port}' || echo ''`;
}

export type IfaceCounters = {
  iface: string;
  rxBytes: number;
  rxPackets: number;
  txBytes: number;
  txPackets: number;
};

/** Parse `/proc/net/dev` rows into real byte/packet counters. */
export function parseNetDev(out: string): IfaceCounters[] {
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, rest] = line.split(":");
      if (!rest || !name) return null;
      const n = rest.trim().split(/\s+/).map(Number);
      if (n.length < 10 || Number.isNaN(n[0])) return null;
      return { iface: name.trim(), rxBytes: n[0], rxPackets: n[1], txBytes: n[8], txPackets: n[9] };
    })
    .filter((v): v is IfaceCounters => v !== null);
}

/** Pull the first IPv4 address out of `ip addr` output. */
export function parseIpv4(out: string): string | null {
  const m = out.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
  return m?.[1] ?? null;
}

export function parseVersion(out: string): string | null {
  const m = out.match(/versionName=([^\s]+)/);
  return m?.[1] ?? null;
}

/** Incremental release number — the API doc gates parameters on this. */
export function parseVersionCode(out: string): number | null {
  const m = out.match(/versionCode=(\d+)/);
  return m ? Number(m[1]) : null;
}

/** `am start -W` prints the activity result. RESULT_OK (-1) means accepted. */
export function parseAmResult(out: string): { ok: boolean; detail: string } {
  const code =
    out.match(/^\s*Result:.*result=(-?\d+)/m)?.[1] ?? out.match(/^\s*result=(-?\d+)/m)?.[1];
  const error = out.match(/^\s*Error:\s*(.+)$/m)?.[1];
  if (error) return { ok: false, detail: error.trim() };
  if (code === "-1") return { ok: true, detail: "accepted" };
  if (code === "0")
    return { ok: false, detail: "PCAPdroid refused — approve on the phone or set an API key" };
  return {
    ok: !/Error|Exception/i.test(out),
    detail: out.trim().split("\n").slice(-1)[0] ?? "sent",
  };
}

/**
 * Version 1.8.6+ accepts `api_key`; older builds always prompt on the phone.
 * Returns a human warning when the current setup will need a manual tap.
 */
export function consentWarning(versionName: string | null, apiKey: string): string | null {
  if (apiKey) return null;
  const label = versionName ? `v${versionName}` : "this build";
  return `no api key — ${label} will prompt on the phone for every start`;
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const u = ["B", "K", "M", "G", "T"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)}${u[i]}`;
}
