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

export function currentProductId(): ProductId {
  const v = (import.meta.env["VITE_BUILD_PROFILE"] as string | undefined) ?? "cb";
  return (PRODUCT_BUILDS.some((b) => b.id === v) ? v : "cb") as ProductId;
}

export function getProduct(id: ProductId = currentProductId()): ProductBuild {
  return PRODUCT_BUILDS.find((b) => b.id === id)!;
}
