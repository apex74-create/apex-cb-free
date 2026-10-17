/**
 * Shared, browser-safe catalogue helpers. No server imports here so both the
 * storefront and the account page can use them.
 */

import type { CatalogProduct } from "./catalog.functions";

export const CATEGORY_LABEL: Record<string, string> = {
  software: "Application",
  firmware: "Hardware firmware",
  bundle: "Bundle",
  service: "Service",
  security: "Security",
  networking: "Networking",
  hardware: "Hardware tooling",
  apps: "Consumer apps",
  internal: "Internal record — not for sale",
};

export const CATEGORY_ORDER = [
  "bundle",
  "software",
  "security",
  "networking",
  "hardware",
  "firmware",
  "apps",
  "service",
  "internal",
];

export function priceLabel(product: Pick<CatalogProduct, "price_usd" | "status">): string {
  if (product.price_usd === null) return "Not priced yet";
  return `$${product.price_usd.toFixed(2)}`;
}

export function statusLabel(status: string): string {
  return status === "live" ? "Available" : "In development";
}

export function groupByCategory(products: CatalogProduct[]) {
  const groups = new Map<string, CatalogProduct[]>();
  for (const product of products) {
    const list = groups.get(product.category) ?? [];
    list.push(product);
    groups.set(product.category, list);
  }
  const ordered = [
    ...CATEGORY_ORDER.filter((c) => groups.has(c)),
    ...[...groups.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort(),
  ];
  return ordered.map((category) => ({
    category,
    label: CATEGORY_LABEL[category] ?? category,
    products: groups.get(category)!,
  }));
}

/**
 * Checkout price ids, keyed by catalogue slug. A product without an entry has
 * no card price yet and the buy button says so rather than failing at checkout.
 */
export const PRICE_IDS: Record<string, string> = {
  "apex-full-stack": "apex_full_stack_lifetime",
  "apex-signal-watch": "apex_signal_watch_onetime",
  "enphase-operator": "enphase_operator_onetime",
  "tremor-map-engine": "tremor_map_engine_onetime",
  "weather-basic": "weather_basic_onetime",
  "operator-field": "operator_field_onetime",
  "tremor-full": "tremor_full_onetime",
  "uap-field-station": "uap_field_station_once",
  "halloween-ghost-station": "halloween_ghost_station_once",
  "mystic-nine-ball": "mystic_nine_ball_once",
  // Cast Net Mesh paid ladder — slugs stay under cast-net-mesh% so has_mesh_builder() grants them.
  "cast-net-mesh-pro": "cast_net_mesh_builder_onetime",
  "cast-net-mesh-pro-cb": "cast_net_mesh_builder_cb_onetime",
  "cast-net-mesh-pro-weather": "cast_net_mesh_builder_weather_onetime",
  "cast-net-mesh-pro-cb-weather": "cast_net_mesh_builder_cb_weather_onetime",
  // Use-based Mesh ladder (2026-10-05). Older builder slugs above map to Personal.
  "cast-net-mesh-personal": "mesh_personal_onetime",
  "cast-net-mesh-personal-cb-weather": "mesh_personal_cb_wx_onetime",
  "cast-net-mesh-venue": "mesh_venue_monthly",
  "cast-net-mesh-venue-annual": "mesh_venue_yearly",
  "cast-net-mesh-venue-pro": "mesh_venue_pro_monthly",
  "cast-net-mesh-venue-pro-annual": "mesh_venue_pro_yearly",
  // Shield connected tier — has_shield_connected() reads apex-shield.
  "apex-shield": "apex_shield_connected_onetime",
  // Weather ladder (standalone — never bundled into Mesh).
  "weather-standard": "weather_standard_onetime",
  "greenhouse-edition": "greenhouse_edition_onetime",
  "gorilla-grow": "gorilla_grow_onetime",
  "gorilla-grow-monthly": "gorilla_grow_monthly",
  // Greenhouse commercial (scales by site and device; device seats billed separately).
  "greenhouse-commercial": "greenhouse_commercial_monthly",
  "greenhouse-commercial-pro": "greenhouse_commercial_pro_monthly",
};
