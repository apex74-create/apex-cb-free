/**
 * One link registry for the three apps + depot. Every page belongs to one
 * group; screens link through these entries, never loose strings, so each
 * app stays one hop from its own pages and the shared set.
 */
export const APP_DOMAINS = {
  depot: "https://tinyradr.com",
  cb: "https://encryptedcb.com",
  mesh: "https://castnetmesh.com",
} as const;

export const CB = {
  splash: "/cb-splash",
  entry: "/cb-welcome",
  radio: "/cb",
  face: "/w",
  wrist: "/wcb",
} as const;

export const MESH = {
  splash: "/mesh-splash",
  events: "/event",
  manage: "/event/manage",
  siteMap: "/site-map",
  vendor: "/event/vendor",
  noTower: "/netchat",
  bridge: "/bridge",
  tester: "/tester",
} as const;

export const WEATHER = {
  hub: "/wx",
  forecast: "/forecast",
  doppler: "/doppler",
  map: "/map",
  array: "/array",
  astro: "/astro",
  briefing: "/briefing",
  observe: "/observe",
} as const;

export const SHARED = {
  depot: "/",
  pricing: "/pricing",
  store: "/store",
  account: "/account",
  auth: "/auth",
  settings: "/settings",
  privacy: "/privacy",
  agreement: "/agreement",
  downloads: "/downloads",
} as const;

/** Operator/internal tools: kept out of public menus. */
export const OPERATOR = {
  diag: "/diag",
  pcap: "/pcap",
  perms: "/perms",
  hardware: "/hardware",
  assembly: "/assembly",
  admin: "/admin",
  inventory: "/inventory",
  playReadiness: "/play-readiness",
} as const;

/** Field toys: linked from the tinyradr.com hub page only, never from app menus. */
export const TOYS = {
  uap: "/uap",
  ghost: "/ghost",
  mystic: "/mystic-nine",
} as const;
