import type { BridgeKind } from "./bridge";

export type AdbCommand = {
  key: string;
  label: string;
  cmd: string;
  tone: "green" | "amber" | "red" | "cyan";
  /** true when the command changes device state */
  write?: boolean;
};

/** Preset deck — a watch has no keyboard, so everything is one tap. */
export const COMMANDS: AdbCommand[] = [
  { key: "devices", label: "DEVICES", cmd: "adb devices -l", tone: "green" },
  { key: "battery", label: "BATTERY", cmd: "shell dumpsys battery", tone: "green" },
  { key: "wifi", label: "WIFI", cmd: "shell dumpsys wifi | head -40", tone: "cyan" },
  { key: "ip", label: "IP ADDR", cmd: "shell ip -f inet addr show wlan0", tone: "cyan" },
  {
    key: "radio",
    label: "4G / RADIO",
    cmd: "shell dumpsys telephony.registry | head -40",
    tone: "cyan",
  },
  { key: "scan", label: "SCAN APS", cmd: "shell cmd wifi list-scan-results", tone: "amber" },
  { key: "gps", label: "GPS FIX", cmd: "shell dumpsys location | head -40", tone: "amber" },
  { key: "props", label: "PROPS", cmd: "shell getprop ro.product.model", tone: "green" },
  { key: "top", label: "TOP PROCS", cmd: "shell top -n 1 -b -m 10", tone: "amber" },
  { key: "logcat", label: "LOGCAT 50", cmd: "shell logcat -d -t 50", tone: "amber" },
  {
    key: "screencap",
    label: "SCREEN OFF",
    cmd: "shell input keyevent 26",
    tone: "red",
    write: true,
  },
  { key: "reboot", label: "REBOOT", cmd: "reboot", tone: "red", write: true },
];

export const kindTone: Record<BridgeKind, "green" | "amber" | "cyan"> = {
  server: "green",
  phone: "amber",
  relay: "cyan",
};
