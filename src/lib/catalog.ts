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
};
