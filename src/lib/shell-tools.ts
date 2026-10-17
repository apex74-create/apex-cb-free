/**
 * Usable bridge shell tools.
 *
 * Every entry is a real `adb` / `adb shell` invocation that runs through the
 * live bridge agent — nothing here is simulated. Grouped so the whole deck is
 * reachable in two taps on a 400x400 watch face.
 */
export type ShellTool = {
  key: string;
  label: string;
  cmd: string;
  tone: "green" | "amber" | "red" | "cyan";
  /** Changes device state — the dock asks for a second tap first. */
  write?: boolean;
};

export type ShellGroup = {
  key: string;
  label: string;
  glyph: string;
  tools: ShellTool[];
};

export const SHELL_GROUPS: ShellGroup[] = [
  {
    key: "link",
    label: "LINK",
    glyph: "⇄",
    tools: [
      { key: "devices", label: "DEVICES", cmd: "adb devices -l", tone: "green" },
      { key: "model", label: "MODEL", cmd: "shell getprop ro.product.model", tone: "green" },
      { key: "build", label: "BUILD", cmd: "shell getprop ro.build.fingerprint", tone: "green" },
      { key: "abi", label: "ABI / SOC", cmd: "shell getprop ro.product.cpu.abi", tone: "green" },
      { key: "uptime", label: "UPTIME", cmd: "shell uptime", tone: "green" },
      { key: "battery", label: "BATTERY", cmd: "shell dumpsys battery", tone: "green" },
    ],
  },
  {
    key: "wifi",
    label: "WIFI",
    glyph: "◎",
    tools: [
      { key: "wifi", label: "WIFI STATE", cmd: "shell dumpsys wifi | head -40", tone: "cyan" },
      { key: "scan", label: "SCAN APS", cmd: "shell cmd wifi list-scan-results", tone: "cyan" },
      { key: "saved", label: "SAVED NETS", cmd: "shell cmd wifi list-networks", tone: "cyan" },
      { key: "ip", label: "IP ADDR", cmd: "shell ip -f inet addr show wlan0", tone: "cyan" },
      { key: "route", label: "ROUTES", cmd: "shell ip route", tone: "cyan" },
      { key: "arp", label: "ARP TABLE", cmd: "shell ip neigh show", tone: "cyan" },
      {
        key: "sockets",
        label: "SOCKETS",
        cmd: "shell ss -tunp 2>/dev/null | head -30",
        tone: "cyan",
      },
      { key: "ping", label: "PING 1.1.1.1", cmd: "shell ping -c 3 1.1.1.1", tone: "cyan" },
    ],
  },
  {
    key: "radio",
    label: "RADIO",
    glyph: "▲",
    tools: [
      {
        key: "radio",
        label: "4G REGISTRY",
        cmd: "shell dumpsys telephony.registry | head -60",
        tone: "amber",
      },
      {
        key: "operator",
        label: "OPERATOR",
        cmd: "shell getprop gsm.operator.alpha",
        tone: "amber",
      },
      { key: "nettype", label: "NET TYPE", cmd: "shell getprop gsm.network.type", tone: "amber" },
      {
        key: "signal",
        label: "SIGNAL",
        cmd: "shell dumpsys telephony.registry | grep -i signalstrength | head -10",
        tone: "amber",
      },
      {
        key: "data",
        label: "DATA STATE",
        cmd: "shell settings get global mobile_data",
        tone: "amber",
      },
      {
        key: "bt",
        label: "BLUETOOTH",
        cmd: "shell dumpsys bluetooth_manager | head -40",
        tone: "amber",
      },
    ],
  },
  {
    key: "geo",
    label: "GEO",
    glyph: "◈",
    tools: [
      { key: "gps", label: "GPS FIX", cmd: "shell dumpsys location | head -60", tone: "green" },
      {
        key: "providers",
        label: "PROVIDERS",
        cmd: "shell settings get secure location_providers_allowed",
        tone: "green",
      },
      {
        key: "sensors",
        label: "SENSORS",
        cmd: "shell dumpsys sensorservice | head -40",
        tone: "green",
      },
      {
        key: "cells",
        label: "CELL INFO",
        cmd: "shell dumpsys telephony.registry | grep -i cellinfo | head -20",
        tone: "green",
      },
    ],
  },
  {
    /**
     * "Pretend to be a VPN": PCAPdroid (and any capture without root) installs
     * a local VPNService and pulls traffic through a tun interface — nothing
     * leaves the device to a remote server. These tools grant the VPN appop,
     * arm/disarm that fake tunnel, and read its real state from the kernel.
     */
    key: "vpn",
    label: "VPN",
    glyph: "⛉",
    tools: [
      {
        key: "vpnstate",
        label: "VPN STATE",
        cmd: "shell dumpsys connectivity 2>/dev/null | grep -iE 'vpn|tun[0-9]' | head -30",
        tone: "cyan",
      },
      {
        key: "vpntun",
        label: "TUN IFACE",
        cmd: "shell ip -f inet addr show tun0 2>/dev/null || echo 'no tun0 — no local vpn up'",
        tone: "cyan",
      },
      {
        key: "vpnroutes",
        label: "TUN ROUTES",
        cmd: "shell ip route show table all 2>/dev/null | grep -i tun | head -20",
        tone: "cyan",
      },
      {
        key: "vpnbytes",
        label: "TUN BYTES",
        cmd: "shell cat /proc/net/dev | grep -E 'Inter|face|tun'",
        tone: "cyan",
      },
      {
        key: "vpnapps",
        label: "VPN APPS",
        cmd: "shell cmd appops query-op ACTIVATE_VPN allow 2>/dev/null || dumpsys package | grep -i BIND_VPN_SERVICE | head -20",
        tone: "cyan",
      },
      {
        key: "vpnalwayson",
        label: "ALWAYS-ON",
        cmd: "shell settings get secure always_on_vpn_app",
        tone: "cyan",
      },
      {
        key: "vpngrant",
        label: "GRANT VPN OP",
        cmd: "shell appops set com.emanuelef.remote_capture ACTIVATE_VPN allow",
        tone: "amber",
        write: true,
      },
      {
        key: "vpnarm",
        label: "ARM LOCAL VPN",
        cmd: "shell am start -W -a android.intent.action.VIEW -e action start -e pcap_dump_mode none -n com.emanuelef.remote_capture/.activities.CaptureCtrl",
        tone: "amber",
        write: true,
      },
      {
        key: "vpndisarm",
        label: "DISARM VPN",
        cmd: "shell am start -W -a android.intent.action.VIEW -e action stop -n com.emanuelef.remote_capture/.activities.CaptureCtrl",
        tone: "red",
        write: true,
      },
      {
        key: "vpnservice",
        label: "VPN SERVICE",
        cmd: "shell dumpsys activity services com.emanuelef.remote_capture 2>/dev/null | grep -iE 'CaptureService|vpn' | head -20",
        tone: "cyan",
      },
    ],
  },
  {
    key: "capture",
    label: "CAPTURE",
    glyph: "◉",
    tools: [
      {
        key: "pcaplist",
        label: "PCAP DIR",
        cmd: "shell ls -l /sdcard/Download/PCAPdroid 2>/dev/null",
        tone: "cyan",
      },
      {
        key: "pcapstart",
        label: "PCAP START",
        cmd: "shell am start -e action start -n com.emanuelef.remote_capture/.activities.CaptureCtrl",
        tone: "cyan",
        write: true,
      },
      {
        key: "pcapstop",
        label: "PCAP STOP",
        cmd: "shell am start -e action stop -n com.emanuelef.remote_capture/.activities.CaptureCtrl",
        tone: "cyan",
        write: true,
      },
      { key: "traffic", label: "IFACE BYTES", cmd: "shell cat /proc/net/dev", tone: "cyan" },
      { key: "logcat", label: "LOGCAT 50", cmd: "shell logcat -d -t 50", tone: "amber" },
      {
        key: "dmesg",
        label: "KERNEL LOG",
        cmd: "shell dmesg 2>/dev/null | tail -30",
        tone: "amber",
      },
    ],
  },
  {
    key: "system",
    label: "SYSTEM",
    glyph: "▤",
    tools: [
      { key: "top", label: "TOP PROCS", cmd: "shell top -n 1 -b -m 10", tone: "amber" },
      { key: "mem", label: "MEMORY", cmd: "shell cat /proc/meminfo | head -12", tone: "amber" },
      { key: "storage", label: "STORAGE", cmd: "shell df -h /data /sdcard", tone: "amber" },
      { key: "packages", label: "PACKAGES", cmd: "shell pm list packages -3", tone: "amber" },
      {
        key: "thermal",
        label: "THERMAL",
        cmd: "shell dumpsys thermalservice | head -30",
        tone: "amber",
      },
      {
        key: "screenoff",
        label: "SCREEN KEY",
        cmd: "shell input keyevent 26",
        tone: "red",
        write: true,
      },
      { key: "reboot", label: "REBOOT", cmd: "reboot", tone: "red", write: true },
    ],
  },
  {
    key: "bio",
    label: "BIO",
    glyph: "♥",
    tools: [
      {
        key: "biosensors",
        label: "BIO SENSORS",
        cmd: "shell dumpsys sensorservice | grep -iE 'heart|ppg|spo2|oxygen|temp|step|offbody'",
        tone: "red",
      },
      {
        key: "sensorlist",
        label: "SENSOR LIST",
        cmd: "shell dumpsys sensorservice | head -60",
        tone: "red",
      },
      {
        key: "hrlog",
        label: "HR LOGCAT",
        cmd: "shell logcat -d -v time -t 2000 | grep -iE 'heart|hr=|bpm|ppg' | tail -40",
        tone: "red",
      },
      {
        key: "bplog",
        label: "BP / SPO2 LOG",
        cmd: "shell logcat -d -v time -t 2000 | grep -iE 'spo2|oxygen|blood|sbp|dbp' | tail -40",
        tone: "red",
      },
      {
        key: "templog",
        label: "TEMP LOG",
        cmd: "shell logcat -d -v time -t 2000 | grep -iE 'temp|thermal' | tail -30",
        tone: "red",
      },
      {
        key: "healthpkg",
        label: "HEALTH PKGS",
        cmd: "shell pm list packages | grep -iE 'health|heart|sport|fit|lokmat|wear'",
        tone: "red",
      },
      {
        key: "batttemp",
        label: "BODY/BATT °C",
        cmd: "shell dumpsys battery | grep -i temperature",
        tone: "red",
      },
    ],
  },
];

export const ALL_SHELL_TOOLS: ShellTool[] = SHELL_GROUPS.flatMap((g) => g.tools);

export const findShellTool = (key: string) => ALL_SHELL_TOOLS.find((t) => t.key === key);
