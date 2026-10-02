/**
 * NO-TOWER transports.
 *
 * Every mode here carries Reticulum without a carrier/cell tower and without
 * any internet relay: local RF only. The watch writes a real Reticulum
 * interface config onto the paired Android node through the ADB bridge and
 * restarts rnsd — nothing is simulated.
 */
import { termux, capture, SPOOL } from "./reticulum";

export type OffgridMode = "auto" | "hotspot" | "rnode" | "usb";

export type OffgridSpec = {
  mode: OffgridMode;
  label: string;
  /** one-line description of the physical carrier */
  carrier: string;
  /** practical range with no infrastructure */
  range: string;
  /** Reticulum interface stanza written to ~/.reticulum/config */
  stanza: (o: OffgridOpts) => string;
};

export type OffgridOpts = {
  /** LoRa frequency in Hz for RNode (US ISM default) */
  freq: number;
  /** LoRa bandwidth in Hz */
  bw: number;
  /** spreading factor 7-12 */
  sf: number;
  /** TX power dBm */
  txp: number;
  /** serial port for the attached RNode */
  port: string;
  /** TCP port used by hotspot / USB legs */
  tcp: number;
};

export const DEFAULTS: OffgridOpts = {
  freq: 915_000_000,
  bw: 125_000,
  sf: 8,
  txp: 17,
  port: "/dev/ttyUSB0",
  tcp: 4242,
};

export const MODES: OffgridSpec[] = [
  {
    mode: "auto",
    label: "AUTO",
    carrier: "IPv6 link-local multicast on any live WiFi/AP leg",
    range: "same AP / same subnet",
    stanza: () => `[[Apex Auto]]
  type = AutoInterface
  interface_enabled = True
  discovery_scope = link`,
  },
  {
    mode: "hotspot",
    label: "HOTSPOT",
    carrier: "phone's own SoftAP — peers join the AP, no uplink needed",
    range: "WiFi coverage (~50-100 m open)",
    stanza: (o) => `[[Apex Hotspot]]
  type = AutoInterface
  interface_enabled = True
  discovery_scope = link
  devices = ap0, wlan0, swlan0

[[Apex Hotspot TCP]]
  type = TCPServerInterface
  interface_enabled = True
  listen_ip = 0.0.0.0
  listen_port = ${o.tcp}`,
  },
  {
    mode: "rnode",
    label: "LORA",
    carrier: "RNode LoRa radio over USB-OTG — fully licence-free ISM RF",
    range: "1-15 km line of sight",
    stanza: (o) => `[[Apex RNode]]
  type = RNodeInterface
  interface_enabled = True
  port = ${o.port}
  frequency = ${o.freq}
  bandwidth = ${o.bw}
  txpower = ${o.txp}
  spreadingfactor = ${o.sf}
  codingrate = 5`,
  },
  {
    mode: "usb",
    label: "TETHER",
    carrier: "USB tether / adb reverse between two handsets, cable only",
    range: "cable",
    stanza: (o) => `[[Apex Tether]]
  type = TCPServerInterface
  interface_enabled = True
  listen_ip = 0.0.0.0
  listen_port = ${o.tcp}`,
  },
];

export const spec = (m: OffgridMode) => MODES.find((s) => s.mode === m) ?? MODES[0]!;

const RC = "/data/data/com.termux/files/home/.reticulum";

/** Full config file: shared instance + the chosen no-tower interface only. */
export function configFile(mode: OffgridMode, o: OffgridOpts = DEFAULTS): string {
  return `[reticulum]
  enable_transport = True
  share_instance = Yes
  panic_on_interface_error = No

[logging]
  loglevel = 4

[interfaces]
${spec(mode).stanza(o)}
`;
}

/** Write the config on the phone and bounce rnsd so it takes effect. */
export function applyCmd(mode: OffgridMode, o: OffgridOpts = DEFAULTS): string {
  const body = configFile(mode, o).replace(/'/g, `'\\''`);
  return termux(
    `mkdir -p ${RC} ${SPOOL}; cp ${RC}/config ${RC}/config.bak 2>/dev/null; ` +
      `printf '%s' '${body}' > ${RC}/config; ` +
      `pkill -f rnsd; sleep 1; nohup rnsd -d >> ${SPOOL}/rnsd.log 2>&1 &`,
  );
}

/** Read back what is actually on disk so the UI never claims an unverified state. */
export const readConfigCmd = () => capture("rconf", `cat ${RC}/config`);

/** True airplane-mode check: no cell radio in use at all. */
export const AIRPLANE = "shell settings get global airplane_mode_on";
export const CELL_STATE = "shell dumpsys telephony.registry | grep -m1 mServiceState";

/** Parse `mServiceState` — state 3 / POWER_OFF means the tower radio is down. */
export function towerDown(airplane: string, svc: string): boolean {
  if (airplane.trim() === "1") return true;
  return /mVoiceRegState=3|POWER_OFF|state=3/i.test(svc);
}

/** Which interface names in rnstatus count as tower-free carriers. */
export function isOffgridIface(name: string): boolean {
  return /auto|rnode|lora|tcpserver|apex (auto|hotspot|rnode|tether)/i.test(name);
}
