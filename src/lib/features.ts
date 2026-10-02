import { TOOLS, type Tool } from "@/lib/tools";

export type FeatureTarget =
  | { to: "/bridge" }
  | { to: "/content" }
  | { to: "/pcap" }
  | { to: "/netchat" }
  | { to: "/hardware" }
  | { to: "/admin" }
  | { to: "/settings" }
  | { to: "/tristar" }
  | { to: "/radar" }
  | { to: "/sextant" }
  | { to: "/flash" }
  | { to: "/perms" }
  | { to: "/radio" }
  | { to: "/assembly" }
  | { to: "/downloads" }
  | { to: "/tool/$key"; params: { key: string } };

export type Feature = {
  /** Stable deep-link slug used in `/?feature=<slug>`. */
  slug: string;
  title: string;
  sub: string;
  blurb: string;
  tone: Tool["tone"];
  glyph: string;
  /** Where "open" lands — the real full-screen screen for this feature. */
  target: FeatureTarget;
  demo:
    | "bridge"
    | "capture"
    | "mesh-chat"
    | "hardware"
    | "admin"
    | "settings"
    | NonNullable<Tool["overlay"]>
    | "panel";
};

const BLURBS: Record<string, string> = {
  mesh: "Plots every mesh peer around your live GPS fix and links them back to this device.",
  ssid: "Sweeps 802.11 beacons and drops each SSID on the map by signal strength.",
  stack: "Stacks overlapping emitters so you can see layered coverage at a glance.",
  rf: "Draws field-strength plates — wider ring, hotter source.",
  tremen: "Breadcrumbs your movement and ties each hop to what it heard there.",
  pcap: "Puts capture flow endpoints on the map with dashed session lines.",
  tetra: "Trilaterates a bearing solve from three or more plotted sources.",
  threat: "Rolling detection feed: rogue APs, deauth bursts, unknown beacons.",
  bruce: "One-tap handheld probe deck for quick field checks.",
  tarwell: "Bait AP with capture log — see who bites.",
  dorito: "Manual bearing triangulator with SSL assignment and paged telephony index.",
  readme: "Scope, legal notes and authorised-use reminder.",
};

/**
 * One registry for the walkthrough. Every entry deep-links straight to the
 * screen that actually implements it — tool overlays go to /tool/$key, and
 * the standalone screens go to their own routes.
 */
export const FEATURES: Feature[] = [
  {
    slug: "bridge",
    title: "ADB Bridge",
    sub: "watch → pc / phone / relay",
    blurb:
      "Runs adb from your wrist over a live socket, failing over PC agent → phone agent → 4G relay.",
    tone: "cyan",
    glyph: "⇋",
    target: { to: "/bridge" },
    demo: "bridge",
  },
  {
    slug: "content",
    title: "Posts · Content",
    sub: "whoop · netlify · field notes",
    blurb:
      "Separate editorial lane for posts and briefings, with Whoop recovery fields and a secure Netlify publish target.",
    tone: "green",
    glyph: "✎",
    target: { to: "/content" },
    demo: "panel",
  },
  {
    slug: "pcapdroid",
    title: "PCAPdroid",
    sub: "real packet capture",
    blurb:
      "Starts and stops a real PCAPdroid capture on the phone and streams the interface counters back.",
    tone: "green",
    glyph: "⌁",
    target: { to: "/pcap" },
    demo: "capture",
  },
  {
    slug: "netchat",
    title: "Netchat · RNS",
    sub: "reticulum mesh · chat token",
    blurb:
      "LXMF messaging over a Reticulum mesh, with every message signed by the sovereign chat token.",
    tone: "amber",
    glyph: "☰",
    target: { to: "/netchat" },
    demo: "mesh-chat",
  },
  {
    slug: "hardware",
    title: "Hardware",
    sub: "bluetooth · radios · board",
    blurb:
      "Reads the real capability table off the watch: BLE peripheral support, radios, sensors and board.",
    tone: "cyan",
    glyph: "❖",
    target: { to: "/hardware" },
    demo: "hardware",
  },
  {
    slug: "radar",
    title: "Apex Radar",
    sub: "rf sweep · rogue homing",
    blurb:
      "Circular RF radar plotting every emitter by real distance, flagging evil twins, and solving a GPS-independent superposition lock from the same anchors.",
    tone: "green",
    glyph: "◎",
    target: { to: "/radar" },
    demo: "panel",
  },
  {
    slug: "sextant",
    title: "Apex Sextant",
    sub: "altitude · azimuth · sky shot",
    blurb:
      "Wrist sighting instrument: altitude off the tilt sensor, azimuth off the magnetometer. Each logged shot disciplines the GPS-free frame and lifts the location trust score.",
    tone: "amber",
    glyph: "∡",
    target: { to: "/sextant" },
    demo: "panel",
  },

  {
    slug: "tristar",
    title: "TriStar 3·6·9",
    sub: "tribit reasoning · vertex memory",
    blurb:
      "Collapses a thought to yes, no or the |9> fulcrum, sweeps 5W=H context, runs the 5P protocol and anchors the outcome in the vertex filing system.",
    tone: "amber",
    glyph: "△",
    target: { to: "/tristar" },
    demo: "panel",
  },
  {
    slug: "flash",
    title: "ESP Flasher",
    sub: "web serial · cyd recovery",
    blurb:
      "Unbricks and reflashes the ESP32-2432S028 NerdMiner board straight from Chrome over USB — erase, write firmware by URL, watch the serial log.",
    tone: "cyan",
    glyph: "⚡",
    target: { to: "/flash" },
    demo: "panel",
  },

  {
    slug: "perms",
    title: "Permission Grid",
    sub: "web bus · hid companions",
    blurb:
      "Turns the granted browser permissions into a hardware bus: probe every capability, pair HID companions, drive output reports and solve a trilateration fix from their live RSSI.",
    tone: "cyan",
    glyph: "⌗",
    target: { to: "/perms" },
    demo: "panel",
  },
  {
    slug: "radio",
    title: "Radio Lab",
    sub: "radioinfo · band lock · gnss",
    blurb:
      "The hidden AOSP radio bench: RadioInfo and the *#*#4636#*#* testing menu, preferred network/band mode, modem power, cell + neighbour survey, GNSS metrics and raw RIL kernel logs.",
    tone: "amber",
    glyph: "≋",
    target: { to: "/radio" },
    demo: "panel",
  },
  {
    slug: "assembly",
    title: "Full Assembly",
    sub: "pcapdroid + termux · sale bundle",
    blurb:
      "The shipping manifest: PCAPdroid, PCAPdroid-mitm, Termux, Termux:API and Termux:Boot — git repos, licences, live installed-state and one-tap install steps.",
    tone: "green",
    glyph: "⧉",
    target: { to: "/assembly" },
    demo: "panel",
  },
  {
    slug: "downloads",
    title: "Downloads",
    sub: "live app · play rollout · signed apk",
    blurb:
      "Release center for the live PWA, Google Play rollout status, and direct signed Android builds with real manifest metadata.",
    tone: "amber",
    glyph: "⬇",
    target: { to: "/downloads" },
    demo: "panel",
  },

  ...TOOLS.map<Feature>((t) => ({
    slug: t.key,
    title: t.name,
    sub: t.sub,
    blurb: BLURBS[t.key] ?? t.sub,
    tone: t.tone,
    glyph: t.glyph,
    target: { to: "/tool/$key" as const, params: { key: t.key } },
    demo: t.kind === "map" ? t.overlay! : "panel",
  })),
  {
    slug: "admin",
    title: "Admin Test Build",
    sub: "sas preflight · assemblies",
    blurb:
      "Flips into the test profile and runs the eight-leg preflight against GitHub, SAS and the bridge.",
    tone: "red",
    glyph: "⚑",
    target: { to: "/admin" },
    demo: "admin",
  },
  {
    slug: "settings",
    title: "Watch Settings",
    sub: "scale · inset · autonomy",
    blurb:
      "Font scale, safe inset and standalone/paired autonomy so nothing clips on your face shape.",
    tone: "green",
    glyph: "⚙",
    target: { to: "/settings" },
    demo: "settings",
  },
];

export const featureIndex = (slug?: string) => {
  const i = FEATURES.findIndex((f) => f.slug === slug);
  return i < 0 ? 0 : i;
};

export const isFeatureSlug = (v: unknown): v is string =>
  typeof v === "string" && FEATURES.some((f) => f.slug === v);
