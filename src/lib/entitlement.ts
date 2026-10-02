/**
 * Entitlement expansion.
 *
 * Some licences are standing grants rather than a single product: holding one
 * of them entitles the account to every shipping product, including products
 * that did not exist on the day of purchase. That has to be resolved when the
 * licences are read, not when they are sold — a snapshot taken at checkout
 * would silently exclude everything released afterwards.
 */

export const GRANT_ALL_SLUGS = [
  "apex-full-stack",
  "apex-full-stack-monthly",
  "tremor-full",
] as const;

/**
 * Fixed bundles: buying the key on the left also entitles the account to the
 * products on the right. Unlike a standing grant this list is finite, so a
 * product released later is not automatically included.
 */
export const BUNDLES: Record<string, string[]> = {
  "operator-field": [
    "apex-signal-watch",
    "weather-basic",
    "enphase-operator",
    "tremor-map-engine",
  ],
  "apex-signal-watch": ["weather-basic", "enphase-operator"],
  "apex-operator-monthly": [
    "apex-signal-watch",
    "weather-basic",
    "enphase-operator",
    "tremor-map-engine",
  ],
  "apex-mobile-monthly": ["apex-signal-watch", "weather-basic", "enphase-operator"],
};

/** Products a purchase of `slug` entitles, excluding standing grants. */
export function bundledSlugs(slug: string): string[] {
  return BUNDLES[slug] ?? [];
}

export type ExpandableLicence = {
  product_slug: string;
  licence_key: string;
  status: string;
  expires_at: string | null;
  created_at: string;
  /** true when the row was derived from a standing grant, not bought directly. */
  derived?: boolean;
};

export function isGrantAll(slug: string): boolean {
  return (GRANT_ALL_SLUGS as readonly string[]).includes(slug);
}

/**
 * Add a derived licence for every shipping product the account does not
 * already hold directly, when it holds a standing grant. Direct licences are
 * always preserved as-is.
 */
export function expandLicences<T extends ExpandableLicence>(
  held: T[],
  shippingSlugs: string[],
): T[] {
  const owned = new Set(held.map((l) => l.product_slug));
  const active = held.filter((l) => l.status === "active");
  const grant = active.find((l) => isGrantAll(l.product_slug));

  // A standing grant covers everything shipping; otherwise each active licence
  // still carries whatever fixed bundle it was sold with.
  const covered = grant
    ? shippingSlugs
    : Array.from(new Set(active.flatMap((l) => bundledSlugs(l.product_slug))));
  const source = grant ?? active[0];
  if (!source || !covered.length) return held;

  const derived = covered
    .filter((slug) => !owned.has(slug))
    .map((slug) => ({
      ...source,
      product_slug: slug,
      derived: true,
    })) as T[];

  return [...held, ...derived];
}
