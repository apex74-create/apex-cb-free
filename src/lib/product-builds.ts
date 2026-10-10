/**
 * The five product builds. One radio core, five names/icons/listings and
 * telemetry paths. VITE_BUILD_PROFILE picks the build at package time;
 * the web deployment serves all of them at their start paths.
 */
export type ProductId = "cb" | "grower" | "sky" | "research" | "radiolab";

export type ProductBuild = {
  id: ProductId;
  name: string;
  shortName: string;
  appId: string;
  startPath: string;
  manifest: string;
  /** Telemetry path on Copilot's AWS data API. */
  telemetryPath: string;
  tools: string[];
  store: { play: boolean; appStore: boolean; desktop: boolean };
  /** Requires sign-in + dated safe-use attestation. */
  gated?: boolean;
  note: string;
};

export const PRODUCT_BUILDS: ProductBuild[] = [
  {
    id: "cb",
    name: "Sovereign CB",
    shortName: "CB",
    appId: "app.lovable.apexsignal.cb",
    startPath: "/cb",
    manifest: "/cb.webmanifest",
    telemetryPath: "/v1/telemetry/cb",
    tools: ["ptt", "rooms", "squad-map", "usb", "ble"],
    store: { play: true, appStore: true, desktop: true },
    note: "Public CB channels and encrypted squad rooms. Over-the-air CB audio stays plaintext.",
  },
  {
    id: "grower",
    name: "Apex Field Grower",
    shortName: "Grower",
    appId: "app.lovable.apexsignal.grower",
    startPath: "/weather",
    manifest: "/manifest.webmanifest",
    telemetryPath: "/v1/telemetry/field",
    tools: ["forecast", "frost", "vpd", "stations", "briefing"],
    store: { play: true, appStore: true, desktop: true },
    note: "Watering, mold and frost decisions. Used for the ag grant work.",
  },
  {
    id: "sky",
    name: "Apex Sky Observer",
    shortName: "Sky",
    appId: "app.lovable.apexsignal.sky",
    startPath: "/astro",
    manifest: "/manifest.webmanifest",
    telemetryPath: "/v1/telemetry/sky",
    tools: ["sky-compass", "sextant", "sightings", "sensors"],
    store: { play: true, appStore: true, desktop: true },
    note: "Dark-sky sensor capture feeding the AWS observation vault.",
  },
  {
    id: "research",
    name: "Apex Research",
    shortName: "Research",
    appId: "app.lovable.apexsignal.research",
    startPath: "/library",
    manifest: "/manifest.webmanifest",
    telemetryPath: "/v1/telemetry/research",
    tools: ["papers", "forecast", "array", "data-export"],
    store: { play: true, appStore: true, desktop: true },
    note: "Non-commercial research identity listing for grant applications.",
  },
  {
    id: "radiolab",
    name: "RadioLab Comms Pack for Network Engineers",
    shortName: "RadioLab",
    appId: "app.lovable.apexsignal.radiolab",
    startPath: "/radiolab",
    manifest: "/manifest.webmanifest",
    telemetryPath: "/v1/telemetry/radiolab",
    tools: ["passive-survey", "channel-density", "wigle-export"],
    store: { play: true, appStore: true, desktop: true },
    gated: true,
    note: "Store builds are passive survey only. Offensive tooling never ships in a store build.",
  },
];

/**
 * CB intercom tiers — the left-hand skeleton panel in every app that
 * carries CB. The tier comes from checkLicences; the panel reads these
 * limits, never hardcodes them.
 *
 * - free: base intercom. 20 channels, constant 20-channel scan,
 *   double-tap stops the scan and transmits, lands on the agreed preset
 *   channel (9 / 19 / 7). Top-bar CB buttons disabled.
 * - full: toggle between the intercom view and the full CB deck.
 * - pro: 40 channels; max: 80+ channels, following the existing schemas.
 *
 * Ceilings stay within the carrier rules: USB carriers only ever send
 * channels 1–40; anything above is digital-only.
 */
export type CbTier = "free" | "full" | "pro" | "max";

export const CB_TIERS: Record<CbTier, { channels: number; scan: boolean; fullDeck: boolean; presetChannel: number }> = {
  free: { channels: 20, scan: true, fullDeck: false, presetChannel: 19 },
  full: { channels: 40, scan: true, fullDeck: true, presetChannel: 19 },
  pro: { channels: 40, scan: true, fullDeck: true, presetChannel: 19 },
  max: { channels: 80, scan: true, fullDeck: true, presetChannel: 19 },
};

/**
 * Greenhouse skin skeletons — skins over the shared skeleton, composed
 * from existing modules (CB intercom, Event Mesh grower plot layout,
 * CYD radar panel). Tier gates run through the existing licence check;
 * no forked code.
 */
export type GreenhouseSkin = {
  id: "greenhouse-base" | "greenhouse-pro";
  name: string;
  cbTier: CbTier;
  /** Daisy-chain handsets allowed on the primary access point. */
  daisyChainHandsets: number;
  /** Secondary handsets may transmit packet data. */
  secondaryTransmit: boolean;
  tools: string[];
  note: string;
};

export const GREENHOUSE_SKINS: GreenhouseSkin[] = [
  {
    id: "greenhouse-base",
    name: "Base Model Greenhouse",
    cbTier: "free",
    daisyChainHandsets: 10,
    secondaryTransmit: false,
    tools: ["cb-intercom", "grower-plot-layout"],
    note: "10 daisy-chained handsets on the primary access point (11 operating total); secondaries receive only. 20-channel intercom plus the Event Mesh Grower's Edition plot layout: plots, fields, streams, forests, walkway paths.",
  },
  {
    id: "greenhouse-pro",
    name: "Guerrilla Growers Pro",
    cbTier: "max",
    daisyChainHandsets: 10,
    secondaryTransmit: true,
    tools: ["cb-full", "mesh-full", "cyd-radar"],
    note: "Maxed-out CB, full mesh, and the left-hand CYD radar panel: plug in a CYD to see radio-signal-adjacent movement nearby that the Shield couldn't see. Signal-adjacent indication only — never person identification.",
  },
];

export function currentProductId(): ProductId {
  const v = (import.meta.env["VITE_BUILD_PROFILE"] as string | undefined) ?? "cb";
  return (PRODUCT_BUILDS.some((b) => b.id === v) ? v : "cb") as ProductId;
}

export function getProduct(id: ProductId = currentProductId()): ProductBuild {
  return PRODUCT_BUILDS.find((b) => b.id === id)!;
}
