export type ToolKind = "map" | "panel";

export type Tool = {
  key: string;
  name: string;
  short: string;
  sub: string;
  kind: ToolKind;
  tone: "green" | "amber" | "red" | "cyan";
  glyph: string;
  /** Overlay flavour for map tools */
  overlay?: "mesh" | "ssid" | "stack" | "rf" | "trail" | "pcap" | "tetra";
};

export const TOOLS: Tool[] = [
  {
    key: "mesh",
    name: "Mesh Map",
    short: "MESH",
    sub: "GPS + live mesh nodes",
    kind: "map",
    tone: "green",
    glyph: "◈",
    overlay: "mesh",
  },
  {
    key: "ssid",
    name: "SSID Radar",
    short: "SSID",
    sub: "802.11 beacon sweep",
    kind: "map",
    tone: "cyan",
    glyph: "◎",
    overlay: "ssid",
  },
  {
    key: "stack",
    name: "Stack Radar",
    short: "STACK",
    sub: "Layered emitter stack",
    kind: "map",
    tone: "amber",
    glyph: "▤",
    overlay: "stack",
  },
  {
    key: "rf",
    name: "RF Plates",
    short: "RF",
    sub: "Field strength plates",
    kind: "map",
    tone: "amber",
    glyph: "◉",
    overlay: "rf",
  },
  {
    key: "tremen",
    name: "Tremen Trail",
    short: "TREMEN",
    sub: "Movement breadcrumb",
    kind: "map",
    tone: "green",
    glyph: "⟿",
    overlay: "trail",
  },
  {
    key: "pcap",
    name: "PCAP Overlay",
    short: "PCAP",
    sub: "Flow endpoints on map",
    kind: "map",
    tone: "cyan",
    glyph: "⇄",
    overlay: "pcap",
  },
  {
    key: "tetra",
    name: "Tetrahedron",
    short: "TETRA",
    sub: "Trilateration solve",
    kind: "map",
    tone: "cyan",
    glyph: "△",
    overlay: "tetra",
  },
  {
    key: "threat",
    name: "Threat Feed",
    short: "THREAT",
    sub: "Live detections",
    kind: "panel",
    tone: "red",
    glyph: "!",
  },
  {
    key: "bruce",
    name: "Bruce-in-a-Box",
    short: "BRUCE",
    sub: "Handheld probe deck",
    kind: "panel",
    tone: "amber",
    glyph: "▣",
  },
  {
    key: "tarwell",
    name: "Tarwell Honeypot",
    short: "TARWELL",
    sub: "Bait AP + captures",
    kind: "panel",
    tone: "red",
    glyph: "☍",
  },
  {
    key: "dorito",
    name: "Dorito Triangle",
    short: "DORITO",
    sub: "Bearing triangulator",
    kind: "panel",
    tone: "amber",
    glyph: "▲",
  },
  {
    key: "readme",
    name: "Read Me",
    short: "INFO",
    sub: "Authorised use only",
    kind: "panel",
    tone: "green",
    glyph: "≡",
  },
];

export const getTool = (key: string) => TOOLS.find((t) => t.key === key);

export const toneClass: Record<Tool["tone"], string> = {
  green: "text-signal",
  amber: "text-warn",
  red: "text-alert",
  cyan: "text-scan",
};

export const toneBorder: Record<Tool["tone"], string> = {
  green: "border-signal/40",
  amber: "border-warn/40",
  red: "border-alert/40",
  cyan: "border-scan/40",
};
